import type { APIRoute } from 'astro';

const GITHUB_REPO = 'tenzan/chb';
const STAGING_WORKFLOW = 'deploy-staging.yml';
const PRODUCTION_WORKFLOW = 'deploy-production.yml';
const CF_PAGES_PROJECT = 'chb';

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'chb-admin',
  };
}

function mapRun(run: any, type: string) {
  const commitMessage = run.head_commit?.message?.split('\n')[0] || '';
  return {
    id: run.id,
    type,
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    updated_at: run.updated_at,
    head_sha: run.head_sha?.substring(0, 7),
    head_sha_full: run.head_sha,
    head_branch: run.head_branch,
    run_number: run.run_number,
    display_title: commitMessage || run.display_title,
    triggering_actor: run.triggering_actor?.login,
    html_url: run.html_url,
  };
}

export const GET: APIRoute = async ({ locals, url }) => {
  const env = locals.runtime.env;
  const githubToken = env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const limit = Math.min(20, parseInt(url.searchParams.get('limit') || '10'));

  const cfToken = env.CLOUDFLARE_API_TOKEN;
  const cfAccountId = env.CLOUDFLARE_ACCOUNT_ID;

  const cfPagesPromise = cfToken && cfAccountId
    ? fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${CF_PAGES_PROJECT}/deployments?per_page=5`,
        { headers: { Authorization: `Bearer ${cfToken}` } }
      ).then(r => r.ok ? r.json() as Promise<{ result: any[] }> : { result: [] }).catch(() => ({ result: [] }))
    : Promise.resolve({ result: [] as any[] });

  const [stagingRes, productionRes, cfPages] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${STAGING_WORKFLOW}/runs?per_page=${limit}`,
      { headers: ghHeaders(githubToken) }
    ),
    fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${PRODUCTION_WORKFLOW}/runs?per_page=${limit}`,
      { headers: ghHeaders(githubToken) }
    ),
    cfPagesPromise,
  ]);

  const cfDeployments = cfPages.result || [];
  const latestCfProduction = cfDeployments.find((d: any) => d.environment === 'production' && d.deployment_trigger?.metadata?.branch !== 'staging');
  const latestCfStaging = cfDeployments.find((d: any) => d.deployment_trigger?.metadata?.branch === 'staging');

  let stagingRuns: any[] = [];
  let latestStaging: any = null;
  if (stagingRes.ok) {
    const data = await stagingRes.json() as { workflow_runs: any[] };
    stagingRuns = data.workflow_runs.map((r: any) => mapRun(r, 'staging'));
    latestStaging = stagingRuns[0] || null;
  }

  let productionRuns: any[] = [];
  let latestProduction: any = null;
  if (productionRes.ok) {
    const data = await productionRes.json() as { workflow_runs: any[] };
    productionRuns = data.workflow_runs.map((r: any) => mapRun(r, 'production'));
    latestProduction = productionRuns[0] || null;
  }

  return new Response(JSON.stringify({
    stagingRuns,
    productionRuns,
    latestStaging,
    latestProduction,
    cfStagingUrl: latestCfStaging?.url || null,
    cfProductionUrl: latestCfProduction?.url || null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env;
  const githubToken = env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${PRODUCTION_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: ghHeaders(githubToken),
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: `Failed to trigger deployment: ${res.status}`, detail: text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: 'Production deployment triggered' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
