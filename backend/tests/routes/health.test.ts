import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
