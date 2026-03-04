import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { hashPassword } from "../../src/lib/password";
import { createSession } from "../../src/lib/session";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

async function loginAsAdmin() {
  const { hash, salt } = await hashPassword("password123");
  const user = await createTestUser({
    email: "admin@test.com",
    name: "Admin",
    passwordHash: hash,
    salt,
    roles: ["Admin"],
  });
  const { token } = await createSession(env.DB, user.id);
  return { user, token };
}

describe("POST /api/admin/parents", () => {
  it("creates user with Parent role", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "parent@test.com",
        name: "Parent User",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("parent@test.com");
    expect(body.data.roles).toContain("Parent");
  });

  it("rejects duplicate email", async () => {
    const { token } = await loginAsAdmin();
    await createTestUser({
      id: crypto.randomUUID(),
      email: "dup@test.com",
      name: "Dup",
    });

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "dup@test.com",
        name: "Duplicate Parent",
      }),
    });

    expect(res.status).toBe(409);
  });

  it("validates required fields", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("requires Admin role", async () => {
    const user = await createTestUser({
      id: crypto.randomUUID(),
      email: "tutor@test.com",
      name: "Tutor",
      roles: ["Tutor"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "parent@test.com",
        name: "Parent",
      }),
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/parents", () => {
  it("lists users with Parent role", async () => {
    const { token } = await loginAsAdmin();
    await createTestUser({
      id: crypto.randomUUID(),
      email: "parent1@test.com",
      name: "Parent 1",
      roles: ["Parent"],
    });
    await createTestUser({
      id: crypto.randomUUID(),
      email: "tutor1@test.com",
      name: "Tutor 1",
      roles: ["Tutor"],
    });

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].email).toBe("parent1@test.com");
  });

  it("requires Admin role", async () => {
    const user = await createTestUser({
      id: crypto.randomUUID(),
      email: "tutor@test.com",
      name: "Tutor",
      roles: ["Tutor"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/parents", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(403);
  });
});
