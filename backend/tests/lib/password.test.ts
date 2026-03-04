import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password";

describe("password", () => {
  it("hashPassword returns hash and salt", async () => {
    const result = await hashPassword("mypassword");
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.salt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashPassword returns different salts each call", async () => {
    const a = await hashPassword("mypassword");
    const b = await hashPassword("mypassword");
    expect(a.salt).not.toBe(b.salt);
  });

  it("verifyPassword returns true for correct password", async () => {
    const { hash, salt } = await hashPassword("correctpassword");
    const result = await verifyPassword("correctpassword", hash, salt);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const { hash, salt } = await hashPassword("correctpassword");
    const result = await verifyPassword("wrongpassword", hash, salt);
    expect(result).toBe(false);
  });
});
