import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { POST as generateHandler } from "../../src/pages/api/admin/password-reset/index";
import { GET as validateHandler, POST as resetHandler } from "../../src/pages/api/auth/reset-password";
import { sha256, toHex, randomBytes } from "../../src/lib/crypto";
import { verifyPassword } from "../../src/lib/password";
import { generateId } from "../../src/lib/id";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

async function createResetToken(
  userId: string,
  createdBy: string,
  options: { expired?: boolean; used?: boolean } = {}
) {
  const db = getTestDB();
  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = options.expired
    ? "2020-01-01T00:00:00Z"
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, tokenHash, expiresAt, options.used ? new Date().toISOString() : null, createdBy)
    .run();

  return { id, rawToken, tokenHash };
}

describe("POST /api/admin/password-reset", () => {
  it("generates a reset token for an active user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { userId: "tutor-1" },
    });
    const res = await generateHandler(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { resetToken: string } };
    expect(body.data.resetToken).toBeTruthy();
    expect(body.data.resetToken.length).toBe(64); // 32 bytes hex

    // Verify token exists in DB
    const tokenHash = await sha256(body.data.resetToken);
    const row = await db
      .prepare("SELECT id FROM password_reset_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .first();
    expect(row).toBeTruthy();
  });

  it("returns 403 for non-Admin", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
      body: { userId: "tutor-1" },
    });
    const res = await generateHandler(ctx);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent user", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { userId: "nonexistent" },
    });
    const res = await generateHandler(ctx);

    expect(res.status).toBe(404);
  });

  it("returns 400 for pending user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    // Create a pending user
    await db
      .prepare("INSERT INTO users (id, email, name, status) VALUES (?, ?, ?, 'pending')")
      .bind("pending-1", "pending@test.com", "")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { userId: "pending-1" },
    });
    const res = await generateHandler(ctx);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("pending");
  });

  it("invalidates previous tokens when generating new one", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const { id: firstTokenId } = await createResetToken("tutor-1", "admin-1");

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { userId: "tutor-1" },
    });
    await generateHandler(ctx);

    // First token should be marked as used
    const firstToken = await db
      .prepare("SELECT used_at FROM password_reset_tokens WHERE id = ?")
      .bind(firstTokenId)
      .first<{ used_at: string | null }>();
    expect(firstToken!.used_at).toBeTruthy();
  });

  it("validates request body", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: {},
    });
    const res = await generateHandler(ctx);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/reset-password", () => {
  it("returns user info for valid token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor User", roles: ["Tutor"] });

    const { rawToken } = await createResetToken("tutor-1", "admin-1");

    const ctx = createMockAPIContext({
      db,
      method: "GET",
      searchParams: { token: rawToken },
    });
    const res = await validateHandler(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { email: string; name: string } };
    expect(body.data.email).toBe("tutor@test.com");
    expect(body.data.name).toBe("Tutor User");
  });

  it("returns 400 for expired token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const { rawToken } = await createResetToken("tutor-1", "admin-1", { expired: true });

    const ctx = createMockAPIContext({
      db,
      method: "GET",
      searchParams: { token: rawToken },
    });
    const res = await validateHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("returns 400 for used token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const { rawToken } = await createResetToken("tutor-1", "admin-1", { used: true });

    const ctx = createMockAPIContext({
      db,
      method: "GET",
      searchParams: { token: rawToken },
    });
    const res = await validateHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing token", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "GET",
    });
    const res = await validateHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid token", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "GET",
      searchParams: { token: "invalidtoken123" },
    });
    const res = await validateHandler(ctx);

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets password and consumes token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({
      id: "tutor-1",
      email: "tutor@test.com",
      name: "Tutor",
      roles: ["Tutor"],
      passwordHash: "oldhash",
      salt: "oldsalt",
    });

    const { rawToken, id: tokenId } = await createResetToken("tutor-1", "admin-1");

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, password: "newpassword123" },
    });
    const res = await resetHandler(ctx);

    expect(res.status).toBe(200);

    // Verify new password works
    const user = await db
      .prepare("SELECT password_hash, salt FROM users WHERE id = ?")
      .bind("tutor-1")
      .first<{ password_hash: string; salt: string }>();
    expect(await verifyPassword("newpassword123", user!.password_hash, user!.salt)).toBe(true);

    // Token should be consumed
    const token = await db
      .prepare("SELECT used_at FROM password_reset_tokens WHERE id = ?")
      .bind(tokenId)
      .first<{ used_at: string | null }>();
    expect(token!.used_at).toBeTruthy();
  });

  it("revokes all sessions after reset", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    // Create a session for the tutor
    const sessionTokenHash = await sha256("session-token-123");
    await db
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(generateId(), "tutor-1", sessionTokenHash, new Date(Date.now() + 86400000).toISOString())
      .run();

    const { rawToken } = await createResetToken("tutor-1", "admin-1");

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, password: "newpassword123" },
    });
    await resetHandler(ctx);

    // Session should be revoked
    const session = await db
      .prepare("SELECT revoked_at FROM sessions WHERE user_id = ?")
      .bind("tutor-1")
      .first<{ revoked_at: string | null }>();
    expect(session!.revoked_at).toBeTruthy();
  });

  it("rejects expired token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const { rawToken } = await createResetToken("tutor-1", "admin-1", { expired: true });

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, password: "newpassword123" },
    });
    const res = await resetHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("rejects used token", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const { rawToken } = await createResetToken("tutor-1", "admin-1", { used: true });

    const ctx = createMockAPIContext({
      db,
      method: "POST",
      body: { token: rawToken, password: "newpassword123" },
    });
    const res = await resetHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("rejects invalid token", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { token: "invalidtoken", password: "newpassword123" },
    });
    const res = await resetHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("validates password minimum length", async () => {
    const ctx = createMockAPIContext({
      db: getTestDB(),
      method: "POST",
      body: { token: "sometoken", password: "abc" },
    });
    const res = await resetHandler(ctx);

    expect(res.status).toBe(400);
  });
});
