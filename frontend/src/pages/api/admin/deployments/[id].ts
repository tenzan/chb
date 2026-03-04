import type { APIRoute } from 'astro';

const GITHUB_REPO = 'tenzan/chb';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env;
  const githubToken = env.GITHUB_TOKEN;
  const runId = params.id;

  if (!githubToken) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ghHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'chb-admin',
  };

  const [runRes, jobsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}`, {
      headers: ghHeaders,
    }),
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs`, {
      headers: ghHeaders,
    }),
  ]);

  if (!runRes.ok) {
    return new Response(JSON.stringify({ error: `GitHub API error: ${runRes.status}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const run = await runRes.json() as any;
  const jobsData = jobsRes.ok ? await jobsRes.json() as { jobs: any[] } : { jobs: [] };

  const jobs = jobsData.jobs.map((job: any) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
    steps: job.steps?.map((step: any) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      started_at: step.started_at,
      completed_at: step.completed_at,
    })) || [],
  }));

  return new Response(JSON.stringify({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    updated_at: run.updated_at,
    head_sha: run.head_sha?.substring(0, 7),
    head_sha_full: run.head_sha,
    head_branch: run.head_branch,
    run_number: run.run_number,
    triggering_actor: run.triggering_actor?.login,
    html_url: run.html_url,
    jobs,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
