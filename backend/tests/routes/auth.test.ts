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

describe("POST /api/auth/login", () => {
  it("success returns user + roles + sets cookie", async () => {
    const { hash, salt } = await hashPassword("password123");
    await createTestUser({
      email: "login@test.com",
      name: "Login User",
      passwordHash: hash,
      salt,
      roles: ["Admin"],
    });

    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@test.com", password: "password123" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; name: string; roles: string[] } };
    expect(body.data.email).toBe("login@test.com");
    expect(body.data.name).toBe("Login User");
    expect(body.data.roles).toContain("Admin");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("wrong password returns 401 with generic message", async () => {
    const { hash, salt } = await hashPassword("password123");
    await createTestUser({
      email: "wrong@test.com",
      passwordHash: hash,
      salt,
    });

    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "wrong@test.com", password: "wrongpassword" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid email or password");
  });

  it("unknown email returns 401 with generic message (no leak)", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@test.com", password: "password123" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid email or password");
  });

  it("validation error for missing fields", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes session and clears cookie", async () => {
    const { hash, salt } = await hashPassword("password123");
    const user = await createTestUser({
      email: "logout@test.com",
      passwordHash: hash,
      salt,
      roles: ["Admin"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("Max-Age=0");

    // Session should be invalid now
    const meRes = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${token}` },
    });
    expect(meRes.status).toBe(401);
  });

  it("returns 401 if not authenticated", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/logout", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns current user with roles", async () => {
    const user = await createTestUser({
      email: "me@test.com",
      name: "Me User",
      roles: ["Admin", "Tutor"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; name: string; roles: string[] } };
    expect(body.data.email).toBe("me@test.com");
    expect(body.data.name).toBe("Me User");
    expect(body.data.roles).toContain("Admin");
    expect(body.data.roles).toContain("Tutor");
  });

  it("returns 401 if not authenticated", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me");
    expect(res.status).toBe(401);
  });
});
