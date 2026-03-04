import { describe, it, expect } from "vitest";
import {
  loginSchema,
  inviteSchema,
  acceptInviteSchema,
  createParentSchema,
  createStudentSchema,
  updateStudentSchema,
  manageRolesSchema,
  createUserSchema,
} from "../../src/lib/validation";

describe("validation schemas", () => {
  describe("loginSchema", () => {
    it("validates email + password required", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional turnstileToken", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
        turnstileToken: "token",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing fields", () => {
      expect(loginSchema.safeParse({}).success).toBe(false);
      expect(loginSchema.safeParse({ email: "test@example.com" }).success).toBe(false);
      expect(loginSchema.safeParse({ password: "abc" }).success).toBe(false);
    });

    it("lowercases email", () => {
      const result = loginSchema.parse({
        email: "Test@Example.COM",
        password: "password123",
      });
      expect(result.email).toBe("test@example.com");
    });
  });

  describe("inviteSchema", () => {
    it("validates email + roleName", () => {
      const result = inviteSchema.safeParse({
        email: "new@example.com",
        roleName: "Admin",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid role", () => {
      const result = inviteSchema.safeParse({
        email: "new@example.com",
        roleName: "SuperUser",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("acceptInviteSchema", () => {
    it("validates token + name + password", () => {
      const result = acceptInviteSchema.safeParse({
        token: "abc123",
        name: "John",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createParentSchema", () => {
    it("validates email + name", () => {
      const result = createParentSchema.safeParse({
        email: "parent@example.com",
        name: "Parent Name",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createStudentSchema", () => {
    it("validates name, optional birthday/description/note", () => {
      const result = createStudentSchema.safeParse({
        name: "Student Name",
        parentUserId: "some-id",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all optional fields", () => {
      const result = createStudentSchema.safeParse({
        name: "Student Name",
        parentUserId: "some-id",
        birthday: "2010-01-15",
        description: "Desc",
        note: "Note",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateStudentSchema", () => {
    it("allows partial fields", () => {
      const result = updateStudentSchema.safeParse({ name: "New Name" });
      expect(result.success).toBe(true);
    });

    it("allows empty object", () => {
      const result = updateStudentSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("manageRolesSchema", () => {
    it("validates add/remove arrays", () => {
      const result = manageRolesSchema.safeParse({
        add: ["Admin"],
        remove: ["Tutor"],
      });
      expect(result.success).toBe(true);
    });

    it("defaults to empty arrays", () => {
      const result = manageRolesSchema.parse({});
      expect(result.add).toEqual([]);
      expect(result.remove).toEqual([]);
    });
  });

  describe("createUserSchema", () => {
    it("validates email + name + password + roles", () => {
      const result = createUserSchema.safeParse({
        email: "user@example.com",
        name: "User",
        password: "password123",
        roles: ["Admin"],
      });
      expect(result.success).toBe(true);
    });
  });
});
