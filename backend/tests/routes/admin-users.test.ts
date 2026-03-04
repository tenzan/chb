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

describe("GET /api/admin/users", () => {
  it("returns list of users with roles (Admin only)", async () => {
    const { token } = await loginAsAdmin();
    await createTestUser({
      id: crypto.randomUUID(),
      email: "other@test.com",
      name: "Other User",
      roles: ["Tutor"],
    });

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; roles: string[] }> };
    expect(body.data.length).toBe(2);
    const otherUser = body.data.find((u) => u.email === "other@test.com");
    expect(otherUser).toBeTruthy();
    expect(otherUser!.roles).toContain("Tutor");
  });

  it("returns 403 for non-Admin", async () => {
    const user = await createTestUser({ roles: ["Tutor"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 if not authenticated", async () => {
    const res = await SELF.fetch("http://localhost/api/admin/users");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/users/:id/roles", () => {
  it("add role to user", async () => {
    const { token } = await loginAsAdmin();
    const target = await createTestUser({
      id: crypto.randomUUID(),
      email: "target@test.com",
      name: "Target",
      roles: ["Tutor"],
    });

    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${target.id}/roles`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ add: ["Personnel"] }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Tutor");
    expect(body.data.roles).toContain("Personnel");
  });

  it("remove role from user", async () => {
    const { token } = await loginAsAdmin();
    const target = await createTestUser({
      id: crypto.randomUUID(),
      email: "target@test.com",
      name: "Target",
      roles: ["Tutor", "Personnel"],
    });

    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${target.id}/roles`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ remove: ["Personnel"] }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Tutor");
    expect(body.data.roles).not.toContain("Personnel");
  });

  it("add and remove simultaneously", async () => {
    const { token } = await loginAsAdmin();
    const target = await createTestUser({
      id: crypto.randomUUID(),
      email: "target@test.com",
      name: "Target",
      roles: ["Tutor"],
    });

    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${target.id}/roles`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ add: ["Personnel"], remove: ["Tutor"] }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Personnel");
    expect(body.data.roles).not.toContain("Tutor");
  });

  it("rejects invalid role names", async () => {
    const { token } = await loginAsAdmin();
    const target = await createTestUser({
      id: crypto.randomUUID(),
      email: "target@test.com",
      name: "Target",
    });

    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${target.id}/roles`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ add: ["SuperUser"] }),
      }
    );

    expect(res.status).toBe(400);
  });

  it("404 for non-existent user", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch(
      "http://localhost/api/admin/users/nonexistent-id/roles",
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ add: ["Admin"] }),
      }
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/users", () => {
  it("create user directly", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch("http://localhost/api/admin/users", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "newuser@test.com",
        name: "New User",
        password: "password123",
        roles: ["Tutor"],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("newuser@test.com");
    expect(body.data.roles).toContain("Tutor");
  });
});
