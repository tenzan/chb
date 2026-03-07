import { describe, it, expect } from "vitest";
import { GET } from "../../src/pages/api/health";
import { createMockAPIContext } from "../setup/mock-context";
import { getTestDB } from "../setup/test-env";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const ctx = createMockAPIContext({ db: getTestDB() });
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
