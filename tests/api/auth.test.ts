import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { POST as loginHandler } from "../../src/pages/api/auth/login";
import { POST as logoutHandler } from "../../src/pages/api/auth/logout";
import { GET as meHandler } from "../../src/pages/api/auth/me";
import { hashPassword } from "../../src/lib/password";
import { createSession } from "../../src/lib/session";

describe("POST /api/auth/login", () => {
  it("success returns user + roles + sets cookie", async () => {
    await seedRoles();
    const db = getTestDB();
    const { hash, salt } = await hashPassword("password123");
    await createTestUser({
      email: "login@test.com",
      name: "Login User",
      passwordHash: hash,
      salt,
      roles: ["Admin"],
    });

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { email: "login@test.com", password: "password123", turnstileToken: "test-token" },
    });
    const res = await loginHandler(ctx);

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
    await seedRoles();
    const db = getTestDB();
    const { hash, salt } = await hashPassword("password123");
    await createTestUser({
      email: "wrong@test.com",
      passwordHash: hash,
      salt,
    });

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { email: "wrong@test.com", password: "wrongpassword", turnstileToken: "test-token" },
    });
    const res = await loginHandler(ctx);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid email or password");
  });

  it("unknown email returns 401 with generic message (no leak)", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { email: "nonexistent@test.com", password: "password123", turnstileToken: "test-token" },
    });
    const res = await loginHandler(ctx);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid email or password");
  });

  it("validation error for missing fields", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: {},
    });
    const res = await loginHandler(ctx);

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes session and clears cookie", async () => {
    await seedRoles();
    const db = getTestDB();
    const { hash, salt } = await hashPassword("password123");
    const user = await createTestUser({
      email: "logout@test.com",
      passwordHash: hash,
      salt,
      roles: ["Admin"],
    });
    const { token } = await createSession(db, user.id);

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      cookies: { session: token },
      user: { id: user.id, email: user.email, name: user.name, roles: ["Admin"] },
    });
    const res = await logoutHandler(ctx);

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 401 if not authenticated", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
    });
    const res = await logoutHandler(ctx);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns current user with roles", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: {
        id: "user-1",
        email: "me@test.com",
        name: "Me User",
        roles: ["Admin", "Tutor"],
      },
    });
    const res = await meHandler(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; name: string; roles: string[] } };
    expect(body.data.email).toBe("me@test.com");
    expect(body.data.name).toBe("Me User");
    expect(body.data.roles).toContain("Admin");
    expect(body.data.roles).toContain("Tutor");
  });
});
