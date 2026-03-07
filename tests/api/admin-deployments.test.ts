import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/deployments/index";
import { GET as getDetail } from "../../src/pages/api/admin/deployments/[id]";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

let originalFetch: typeof globalThis.fetch;

function makeFakeRun(overrides: any = {}) {
  return {
    id: 12345,
    status: "completed",
    conclusion: "success",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:05:00Z",
    head_sha: "abc1234def5678",
    head_branch: "main",
    run_number: 42,
    display_title: "Test commit",
    head_commit: { message: "Test commit message" },
    triggering_actor: { login: "testuser" },
    html_url: "https://github.com/tenzan/chb/actions/runs/12345",
    ...overrides,
  };
}

beforeEach(async () => {
  await seedRoles();
  await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
  await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  }) as any;
}

describe("GET /api/admin/deployments", () => {
  it("returns 403 for non-Admin role", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      url: "http://localhost:4321/api/admin/deployments",
    });
    const res = await GET(ctx);
    expect(res.status).toBe(403);
  });

  it("returns deployment data on success", async () => {
    const fakeRun = makeFakeRun();

    mockFetch((url) => {
      if (url.includes("deploy-staging.yml/runs") || url.includes("deploy-production.yml/runs")) {
        return new Response(JSON.stringify({ workflow_runs: [fakeRun] }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      url: "http://localhost:4321/api/admin/deployments",
      searchParams: { limit: "7" },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        stagingRuns: any[];
        productionRuns: any[];
        latestStaging: any;
        latestProduction: any;
      };
    };

    expect(body.data.stagingRuns).toHaveLength(1);
    expect(body.data.productionRuns).toHaveLength(1);
    expect(body.data.latestStaging.id).toBe(12345);
    expect(body.data.latestProduction.id).toBe(12345);
    expect(body.data.latestStaging.head_sha).toBe("abc1234");
    expect(body.data.latestStaging.display_title).toBe("Test commit message");
  });

  it("handles GitHub API errors gracefully", async () => {
    mockFetch(() => {
      return new Response("Internal Server Error", { status: 500 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      url: "http://localhost:4321/api/admin/deployments",
      searchParams: { limit: "3" },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { stagingRuns: any[]; productionRuns: any[] };
    };
    expect(body.data.stagingRuns).toHaveLength(0);
    expect(body.data.productionRuns).toHaveLength(0);
  });
});

describe("GET /api/admin/deployments/:id", () => {
  it("returns 403 for non-Admin role", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      params: { id: "12345" },
    });
    const res = await getDetail(ctx);
    expect(res.status).toBe(403);
  });

  it("returns run detail with jobs and steps", async () => {
    const runId = "77777";
    const fakeRun = makeFakeRun({ id: 77777 });

    mockFetch((url) => {
      if (url.includes(`/actions/runs/${runId}/jobs`)) {
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: 1,
                name: "deploy",
                status: "completed",
                conclusion: "success",
                started_at: "2025-01-01T00:00:00Z",
                completed_at: "2025-01-01T00:05:00Z",
                steps: [
                  {
                    name: "Checkout",
                    status: "completed",
                    conclusion: "success",
                    number: 1,
                    started_at: "2025-01-01T00:00:00Z",
                    completed_at: "2025-01-01T00:01:00Z",
                  },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes(`/actions/runs/${runId}`)) {
        return new Response(JSON.stringify(fakeRun), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      params: { id: runId },
    });
    const res = await getDetail(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        id: number;
        head_sha: string;
        jobs: Array<{
          name: string;
          steps: Array<{ name: string }>;
        }>;
      };
    };
    expect(body.data.id).toBe(77777);
    expect(body.data.head_sha).toBe("abc1234");
    expect(body.data.jobs).toHaveLength(1);
    expect(body.data.jobs[0].name).toBe("deploy");
    expect(body.data.jobs[0].steps).toHaveLength(1);
    expect(body.data.jobs[0].steps[0].name).toBe("Checkout");
  });

  it("returns 502 when GitHub API fails", async () => {
    const runId = "88888";

    mockFetch((url) => {
      if (url.includes(`/actions/runs/${runId}/jobs`)) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      params: { id: runId },
    });
    const res = await getDetail(ctx);

    expect(res.status).toBe(502);
  });
});

describe("POST /api/admin/deployments", () => {
  it("returns 403 for non-Admin role", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
    });
    const res = await POST(ctx);
    expect(res.status).toBe(403);
  });

  it("triggers workflow_dispatch on success", async () => {
    mockFetch((url) => {
      if (url.includes("/dispatches")) {
        return new Response(null, { status: 204 });
      }
      return new Response("Not found", { status: 404 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
    });
    const res = await POST(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { ok: boolean; message: string };
    };
    expect(body.data.ok).toBe(true);
    expect(body.data.message).toBe("Production deployment triggered");
  });

  it("returns 502 when GitHub dispatch fails", async () => {
    mockFetch((url) => {
      if (url.includes("/dispatches")) {
        return new Response("Unprocessable Entity", { status: 422 });
      }
      return new Response("Not found", { status: 404 });
    });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
    });
    const res = await POST(ctx);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Failed to trigger deployment");
  });
});
