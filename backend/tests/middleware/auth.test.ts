import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { createSession } from "../../src/lib/session";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

describe("auth middleware", () => {
  it("returns 401 if no cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me");
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("returns 401 if invalid session token", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Cookie: "session=invalidtoken" },
    });
    expect(res.status).toBe(401);
  });

  it("sets user variable on context for valid session", async () => {
    const user = await createTestUser({
      email: "valid@test.com",
      name: "Valid User",
      roles: ["Admin"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; name: string; roles: string[] } };
    expect(body.data.email).toBe("valid@test.com");
    expect(body.data.name).toBe("Valid User");
  });

  it("returns user with roles array", async () => {
    const user = await createTestUser({
      email: "multi@test.com",
      name: "Multi Role",
      roles: ["Admin", "Tutor"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Admin");
    expect(body.data.roles).toContain("Tutor");
  });
});
