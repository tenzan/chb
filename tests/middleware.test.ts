import { describe, it, expect } from "vitest";
import { getTestDB } from "./setup/test-env";
import { seedRoles, createTestUser } from "./setup/seed";
import { createMockAPIContext } from "./setup/mock-context";
import { createSession } from "../src/lib/session";
import { hasRole } from "../src/lib/rbac";
import { validateSession } from "../src/lib/session";

// These tests verify the middleware logic through unit tests
// of the session validation and RBAC functions it relies on.
// Full middleware integration is covered by E2E tests.

describe("auth middleware logic", () => {
  it("validateSession returns null if no session token", async () => {
    const db = getTestDB();
    const result = await validateSession(db, "");
    expect(result).toBeNull();
  });

  it("validateSession returns null for invalid session token", async () => {
    const db = getTestDB();
    const result = await validateSession(db, "invalidtoken");
    expect(result).toBeNull();
  });

  it("validateSession returns user data for valid session", async () => {
    await seedRoles();
    const db = getTestDB();
    const user = await createTestUser({
      email: "valid@test.com",
      name: "Valid User",
      roles: ["Admin"],
    });
    const { token } = await createSession(db, user.id);

    const result = await validateSession(db, token);
    expect(result).not.toBeNull();
    expect(result!.email).toBe("valid@test.com");
    expect(result!.name).toBe("Valid User");
  });

  it("validateSession returns user with roles array", async () => {
    await seedRoles();
    const db = getTestDB();
    const user = await createTestUser({
      email: "multi@test.com",
      name: "Multi Role",
      roles: ["Admin", "Tutor"],
    });
    const { token } = await createSession(db, user.id);

    const result = await validateSession(db, token);
    expect(result).not.toBeNull();
    expect(result!.roles).toContain("Admin");
    expect(result!.roles).toContain("Tutor");
  });
});

describe("rbac middleware logic", () => {
  it("hasRole returns true for matching role", () => {
    const user = { id: "1", email: "a@b.com", name: "A", roles: ["Admin"] };
    expect(hasRole(user, "Admin")).toBe(true);
  });

  it("hasRole returns false for non-matching role", () => {
    const user = { id: "1", email: "a@b.com", name: "A", roles: ["Tutor"] };
    expect(hasRole(user, "Admin")).toBe(false);
  });

  it("hasRole returns false for user with other roles only", () => {
    const user = { id: "1", email: "a@b.com", name: "A", roles: ["Personnel", "Tutor"] };
    expect(hasRole(user, "Admin")).toBe(false);
  });

  it("hasRole accepts multiple roles (any match)", () => {
    const user = { id: "1", email: "a@b.com", name: "A", roles: ["Tutor"] };
    expect(hasRole(user, "Admin", "Tutor")).toBe(true);
  });
});
