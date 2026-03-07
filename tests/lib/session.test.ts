import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createSession, validateSession, revokeSession, setSessionCookie, clearSessionCookie } from "../../src/lib/session";
import { sha256 } from "../../src/lib/crypto";

describe("session", () => {
  describe("createSession", () => {
    it("inserts session with hashed token into DB", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({ roles: ["Admin"] });
      const { token, sessionId } = await createSession(db, user.id);

      expect(token).toBeTruthy();
      expect(sessionId).toBeTruthy();

      const tokenHash = await sha256(token);
      const row = await db
        .prepare("SELECT token_hash FROM sessions WHERE id = ?")
        .bind(sessionId)
        .first<{ token_hash: string }>();

      expect(row).not.toBeNull();
      expect(row!.token_hash).toBe(tokenHash);
    });

    it("returns raw token", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(db, user.id);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("validateSession", () => {
    it("returns user data for valid token", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({
        email: "admin@test.com",
        name: "Admin User",
        roles: ["Admin"],
      });
      const { token } = await createSession(db, user.id);

      const result = await validateSession(db, token);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.email).toBe("admin@test.com");
      expect(result!.name).toBe("Admin User");
      expect(result!.roles).toContain("Admin");
    });

    it("returns null for invalid token", async () => {
      const db = getTestDB();
      const result = await validateSession(db, "invalidtoken");
      expect(result).toBeNull();
    });

    it("returns null for expired session", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(db, user.id);

      const tokenHash = await sha256(token);
      await db
        .prepare(
          "UPDATE sessions SET expires_at = '2020-01-01T00:00:00Z' WHERE token_hash = ?"
        )
        .bind(tokenHash)
        .run();

      const result = await validateSession(db, token);
      expect(result).toBeNull();
    });

    it("returns null for revoked session", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(db, user.id);

      const tokenHash = await sha256(token);
      await revokeSession(db, tokenHash);

      const result = await validateSession(db, token);
      expect(result).toBeNull();
    });
  });

  describe("revokeSession", () => {
    it("sets revoked_at", async () => {
      await seedRoles();
      const db = getTestDB();
      const user = await createTestUser({ roles: ["Admin"] });
      const { token } = await createSession(db, user.id);
      const tokenHash = await sha256(token);

      await revokeSession(db, tokenHash);

      const row = await db
        .prepare("SELECT revoked_at FROM sessions WHERE token_hash = ?")
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
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
    });

    it("clearSessionCookie returns expired cookie", () => {
      const cookie = clearSessionCookie();
      expect(cookie).toContain("session=");
      expect(cookie).toContain("Max-Age=0");
    });
  });
});
