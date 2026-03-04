import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { hashPassword } from "../../src/lib/password";
import { createSession } from "../../src/lib/session";
import { sha256, toHex, randomBytes } from "../../src/lib/crypto";
import { generateId } from "../../src/lib/id";

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

async function createInvite(
  createdBy: string,
  email: string,
  roleName: string,
  options: { expired?: boolean; used?: boolean } = {}
) {
  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = options.expired
    ? "2020-01-01T00:00:00Z"
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO invites (id, email, role_name, token_hash, token, expires_at, used_at, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      email,
      roleName,
      tokenHash,
      rawToken,
      expiresAt,
      options.used ? new Date().toISOString() : null,
      createdBy
    )
    .run();

  return { id, rawToken, tokenHash };
}

describe("POST /api/admin/invites", () => {
  it("creates invite, returns ok (Admin only)", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invitee@test.com",
        roleName: "Tutor",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { inviteToken: string } };
    expect(body.data.inviteToken).toBeTruthy();
  });

  it("rejects invalid role", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invitee@test.com",
        roleName: "SuperUser",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects duplicate active invite for same email+role", async () => {
    const { user, token } = await loginAsAdmin();
    await createInvite(user.id, "invitee@test.com", "Tutor");

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invitee@test.com",
        roleName: "Tutor",
      }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 403 for non-Admin", async () => {
    const user = await createTestUser({ roles: ["Tutor"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invitee@test.com",
        roleName: "Tutor",
      }),
    });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/invites/accept", () => {
  it("creates user, assigns role, sets session cookie", async () => {
    const { user } = await loginAsAdmin();
    const { rawToken } = await createInvite(user.id, "new@test.com", "Tutor");

    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "New User",
        password: "newpassword123",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("new@test.com");
    expect(body.data.roles).toContain("Tutor");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=");
  });

  it("sets password for existing user without password", async () => {
    const { user } = await loginAsAdmin();
    // Create user without password
    const existingId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name) VALUES (?, ?, ?)`
    )
      .bind(existingId, "existing@test.com", "Existing User")
      .run();

    const { rawToken } = await createInvite(user.id, "existing@test.com", "Tutor");

    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "Existing User",
        password: "newpassword123",
      }),
    });

    expect(res.status).toBe(200);

    // Verify password was set
    const dbUser = await env.DB.prepare(
      "SELECT password_hash, salt FROM users WHERE email = ?"
    )
      .bind("existing@test.com")
      .first<{ password_hash: string; salt: string }>();
    expect(dbUser!.password_hash).toBeTruthy();
    expect(dbUser!.salt).toBeTruthy();
  });

  it("does not overwrite existing password", async () => {
    const { user } = await loginAsAdmin();
    const { hash, salt } = await hashPassword("originalpassword");
    const existingUser = await createTestUser({
      id: crypto.randomUUID(),
      email: "withpass@test.com",
      name: "With Pass",
      passwordHash: hash,
      salt,
    });

    const { rawToken } = await createInvite(user.id, "withpass@test.com", "Tutor");

    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "With Pass",
        password: "newpassword123",
      }),
    });

    expect(res.status).toBe(200);

    // Verify original password still works
    const dbUser = await env.DB.prepare(
      "SELECT password_hash, salt FROM users WHERE email = ?"
    )
      .bind("withpass@test.com")
      .first<{ password_hash: string; salt: string }>();
    expect(dbUser!.password_hash).toBe(hash);
  });

  it("rejects expired token", async () => {
    const { user } = await loginAsAdmin();
    const { rawToken } = await createInvite(user.id, "expired@test.com", "Tutor", {
      expired: true,
    });

    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "Expired",
        password: "password123",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects already-used token", async () => {
    const { user } = await loginAsAdmin();
    const { rawToken } = await createInvite(user.id, "used@test.com", "Tutor", {
      used: true,
    });

    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "Used",
        password: "password123",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects invalid token", async () => {
    const res = await SELF.fetch("http://localhost/api/admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "invalidtoken",
        name: "Invalid",
        password: "password123",
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/invites", () => {
  it("returns list of invites", async () => {
    const { user, token } = await loginAsAdmin();
    await createInvite(user.id, "pending@test.com", "Tutor");
    await createInvite(user.id, "used@test.com", "Admin", { used: true });

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; role_name: string; token: string; used_at: string | null }> };
    expect(body.data.length).toBe(2);
    const pending = body.data.find((i) => i.email === "pending@test.com");
    expect(pending).toBeTruthy();
    expect(pending!.token).toBeTruthy();
    expect(pending!.used_at).toBeNull();
  });

  it("returns 403 for non-Admin", async () => {
    const user = await createTestUser({ roles: ["Tutor"] });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/invites", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(403);
  });
});
