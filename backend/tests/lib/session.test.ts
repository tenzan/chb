import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { createSession, validateSession, revokeSession, setSessionCookie, clearSessionCookie } from "../../src/lib/session";
import { sha256 } from "../../src/lib/crypto";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

describe("session", () => {
  describe("createSession", () => {
    it("inserts session with hashed token into DB", async () => {
      const user = await createTestUser({ roles: ["Admin"] });
      const { token, sessionId } = await createSession(env.DB, user.id);

      expect(token).toBeTruthy();
      expect(sessionId).toBeTruthy();

      // Verify the token is stored hashed
      const tokenHash = await sha256(token);
      const row = await env.DB.prepare(
        "SELECT token_hash FROM sessions WHERE id = ?"
      )
        .bind(sessionId)
        .first<{ token_hash: string }>();

      expect(row).not.toBeNull();
      expect(row!.token_hash).toBe(tokenHash);
    });

    it("returns raw token", async () => {
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(env.DB, user.id);
      // Raw token should be 64 hex chars (32 bytes)
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("validateSession", () => {
    it("returns user data for valid token", async () => {
      const user = await createTestUser({
        email: "admin@test.com",
        name: "Admin User",
        roles: ["Admin"],
      });
      const { token } = await createSession(env.DB, user.id);

      const result = await validateSession(env.DB, token);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.email).toBe("admin@test.com");
      expect(result!.name).toBe("Admin User");
      expect(result!.roles).toContain("Admin");
    });

    it("returns null for invalid token", async () => {
      const result = await validateSession(env.DB, "invalidtoken");
      expect(result).toBeNull();
    });

    it("returns null for expired session", async () => {
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(env.DB, user.id);

      // Manually expire the session
      const tokenHash = await sha256(token);
      await env.DB.prepare(
        "UPDATE sessions SET expires_at = '2020-01-01T00:00:00Z' WHERE token_hash = ?"
      )
        .bind(tokenHash)
        .run();

      const result = await validateSession(env.DB, token);
      expect(result).toBeNull();
    });

    it("returns null for revoked session", async () => {
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(env.DB, user.id);

      // Revoke the session
      const tokenHash = await sha256(token);
      await revokeSession(env.DB, tokenHash);

      const result = await validateSession(env.DB, token);
      expect(result).toBeNull();
    });
  });

  describe("revokeSession", () => {
    it("sets revoked_at", async () => {
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(env.DB, user.id);
      const tokenHash = await sha256(token);

      await revokeSession(env.DB, tokenHash);

      const row = await env.DB.prepare(
        "SELECT revoked_at FROM sessions WHERE token_hash = ?"
      )
        .bind(tokenHash)
        .first<{ revoked_at: string }>();
      expect(row!.revoked_at).not.toBeNull();
    });
  });

  describe("cookie helpers", () => {
    it("setSessionCookie returns correct Set-Cookie header", () => {
      const cookie = setSessionCookie("mytoken123");
      expect(cookie).toContain("session=mytoken123");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=None");
      expect(cookie).toContain("Path=/");
    });

    it("clearSessionCookie returns expired cookie", () => {
      const cookie = clearSessionCookie();
      expect(cookie).toContain("session=");
      expect(cookie).toContain("Max-Age=0");
    });
  });
});
