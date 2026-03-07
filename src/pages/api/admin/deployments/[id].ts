import type { APIRoute } from "astro";
import { getEnv } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";

const GITHUB_REPO = "tenzan/chb";

const DETAIL_CACHE_TTL_MS = 10_000;
const detailCache = new Map<string, { data: any; timestamp: number }>();

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "chb-admin",
  };
}

export const GET: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const env = getEnv(locals);
  const githubToken = env.GITHUB_TOKEN;
  const runId = params.id!;

  if (!githubToken) {
    return new Response(
      JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const cached = detailCache.get(runId);
  if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_TTL_MS) {
    return new Response(JSON.stringify({ data: cached.data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = ghHeaders(githubToken);

  const [runRes, jobsRes] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}`,
      { headers }
    ),
    fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs`,
      { headers }
    ),
  ]);

  if (!runRes.ok) {
    return new Response(
      JSON.stringify({ error: `GitHub API error: ${runRes.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const run = (await runRes.json()) as any;
  const jobsData = jobsRes.ok
    ? ((await jobsRes.json()) as { jobs: any[] })
    : { jobs: [] };

  const jobs = jobsData.jobs.map((job: any) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
    steps:
      job.steps?.map((step: any) => ({
        name: step.name,
        status: step.status,
        conclusion: step.conclusion,
        number: step.number,
        started_at: step.started_at,
        completed_at: step.completed_at,
      })) || [],
  }));

  const result = {
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
  };

  detailCache.set(runId, { data: result, timestamp: Date.now() });

  return new Response(JSON.stringify({ data: result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
