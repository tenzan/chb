import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { createSession } from "../../src/lib/session";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

describe("rbac middleware", () => {
  it("requireRole('Admin') allows Admin user", async () => {
    const user = await createTestUser({ roles: ["Admin"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { Cookie: `session=${token}` },
    });
    // Should not be 403
    expect(res.status).not.toBe(403);
  });

  it("requireRole('Admin') returns 403 for non-Admin", async () => {
    const user = await createTestUser({ roles: ["Tutor"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("requireRole('Admin') returns 403 for user with other roles only", async () => {
    const user = await createTestUser({ roles: ["Personnel", "Tutor"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(403);
  });
});
