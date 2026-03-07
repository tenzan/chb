import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/invites/index";
import { POST as acceptHandler } from "../../src/pages/api/admin/invites/accept";
import { DELETE as deleteHandler } from "../../src/pages/api/admin/invites/[id]";
import { hashPassword } from "../../src/lib/password";
import { sha256, toHex, randomBytes } from "../../src/lib/crypto";
import { generateId } from "../../src/lib/id";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

async function createInvite(
  createdBy: string,
  email: string,
  roleName: string,
  options: { expired?: boolean; used?: boolean } = {}
) {
  const db = getTestDB();
  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = options.expired
    ? "2020-01-01T00:00:00Z"
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
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
  it("creates invite and pending user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { email: "invitee@test.com", roleName: "Tutor" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { inviteToken: string } };
    expect(body.data.inviteToken).toBeTruthy();

    // A pending user should have been created
    const pendingUser = await db
      .prepare("SELECT id, email, status FROM users WHERE email = ?")
      .bind("invitee@test.com")
      .first<{ id: string; email: string; status: string }>();
    expect(pendingUser).toBeTruthy();
    expect(pendingUser!.status).toBe("pending");

    // The pending user should have the Tutor role
    const roles = await db
      .prepare("SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?")
      .bind(pendingUser!.id)
      .all<{ name: string }>();
    expect(roles.results.map(r => r.name)).toContain("Tutor");
  });

  it("rejects invalid role", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { email: "invitee@test.com", roleName: "SuperUser" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(400);
  });

  it("rejects duplicate active invite for same email+role", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createInvite("admin-1", "invitee@test.com", "Tutor");

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { email: "invitee@test.com", roleName: "Tutor" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(409);
  });

  it("returns 403 for non-Admin", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
      body: { email: "invitee@test.com", roleName: "Tutor" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/invites/accept", () => {
  it("activates pending user, sets password, sets session cookie", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const { rawToken } = await createInvite("admin-1", "new@test.com", "Tutor");

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, name: "New User", password: "newpassword123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("new@test.com");
    expect(body.data.roles).toContain("Tutor");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=");

    // User should now be active
    const user = await db
      .prepare("SELECT status FROM users WHERE email = ?")
      .bind("new@test.com")
      .first<{ status: string }>();
    expect(user!.status).toBe("active");
  });

  it("sets password for existing user without password", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const existingId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
      .bind(existingId, "existing@test.com", "Existing User")
      .run();

    const { rawToken } = await createInvite("admin-1", "existing@test.com", "Tutor");

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, name: "Existing User", password: "newpassword123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(200);

    const dbUser = await db
      .prepare("SELECT password_hash, salt FROM users WHERE email = ?")
      .bind("existing@test.com")
      .first<{ password_hash: string; salt: string }>();
    expect(dbUser!.password_hash).toBeTruthy();
    expect(dbUser!.salt).toBeTruthy();
  });

  it("does not overwrite existing password", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const { hash, salt } = await hashPassword("originalpassword");
    await createTestUser({
      id: crypto.randomUUID(),
      email: "withpass@test.com",
      name: "With Pass",
      passwordHash: hash,
      salt,
    });

    const { rawToken } = await createInvite("admin-1", "withpass@test.com", "Tutor");

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, name: "With Pass", password: "newpassword123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(200);

    const dbUser = await db
      .prepare("SELECT password_hash, salt FROM users WHERE email = ?")
      .bind("withpass@test.com")
      .first<{ password_hash: string; salt: string }>();
    expect(dbUser!.password_hash).toBe(hash);
  });

  it("rejects expired token", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const { rawToken } = await createInvite("admin-1", "expired@test.com", "Tutor", { expired: true });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { token: rawToken, name: "Expired", password: "password123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("rejects already-used token", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const { rawToken } = await createInvite("admin-1", "used@test.com", "Tutor", { used: true });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { token: rawToken, name: "Used", password: "password123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("rejects invalid token", async () => {
    await seedRoles();
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { token: "invalidtoken", name: "Invalid", password: "password123" },
    });
    const res = await acceptHandler(ctx);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/invites", () => {
  it("returns list of invites", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createInvite("admin-1", "pending@test.com", "Tutor");
    await createInvite("admin-1", "used@test.com", "Admin", { used: true });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; role_name: string; token: string; used_at: string | null }> };
    expect(body.data.length).toBe(2);
    const pending = body.data.find((i) => i.email === "pending@test.com");
    expect(pending).toBeTruthy();
    expect(pending!.token).toBeTruthy();
    expect(pending!.used_at).toBeNull();
  });

  it("returns 403 for non-Admin", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
    });
    const res = await GET(ctx);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/invites/:id", () => {
  it("revokes invite and deletes pending user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    // Create invite via POST (which also creates pending user)
    const createCtx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { email: "revokee@test.com", roleName: "Tutor" },
    });
    await POST(createCtx);

    // Verify pending user exists
    const pendingBefore = await db
      .prepare("SELECT id FROM users WHERE email = ? AND status = 'pending'")
      .bind("revokee@test.com")
      .first();
    expect(pendingBefore).toBeTruthy();

    // Get the invite ID
    const invite = await db
      .prepare("SELECT id FROM invites WHERE email = ? AND used_at IS NULL")
      .bind("revokee@test.com")
      .first<{ id: string }>();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "DELETE",
      params: { id: invite!.id },
    });
    const res = await deleteHandler(ctx);

    expect(res.status).toBe(200);

    // Invite should be gone
    const inviteAfter = await db
      .prepare("SELECT id FROM invites WHERE id = ?")
      .bind(invite!.id)
      .first();
    expect(inviteAfter).toBeNull();

    // Pending user should be gone
    const pendingAfter = await db
      .prepare("SELECT id FROM users WHERE email = ? AND status = 'pending'")
      .bind("revokee@test.com")
      .first();
    expect(pendingAfter).toBeNull();
  });

  it("returns 404 for non-existent invite", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "DELETE",
      params: { id: "nonexistent-id" },
    });
    const res = await deleteHandler(ctx);

    expect(res.status).toBe(404);
  });

  it("returns 403 for non-Admin", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "DELETE",
      params: { id: "some-id" },
    });
    const res = await deleteHandler(ctx);

    expect(res.status).toBe(403);
  });
});
