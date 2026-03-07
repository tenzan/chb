import { describe, it, expect } from "vitest";
import { sha256, randomBytes, toHex, fromHex, timingSafeEqual } from "../../src/lib/crypto";

describe("crypto", () => {
  describe("sha256", () => {
    it("returns consistent hex hash for same input", async () => {
      const hash1 = await sha256("hello");
      const hash2 = await sha256("hello");
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different hashes for different inputs", async () => {
      const hash1 = await sha256("hello");
      const hash2 = await sha256("world");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("randomBytes", () => {
    it("returns requested length", () => {
      const bytes = randomBytes(32);
      expect(bytes.length).toBe(32);
    });

    it("returns different values each call", () => {
      const a = randomBytes(32);
      const b = randomBytes(32);
      expect(toHex(a)).not.toBe(toHex(b));
    });
  });

  describe("toHex / fromHex", () => {
    it("roundtrips correctly", () => {
      const original = randomBytes(16);
      const hex = toHex(original);
      const restored = fromHex(hex);
      expect(toHex(restored)).toBe(hex);
    });
  });

  describe("timingSafeEqual", () => {
    it("returns true for equal strings", () => {
      expect(timingSafeEqual("abc123", "abc123")).toBe(true);
    });

    it("returns false for different strings", () => {
      expect(timingSafeEqual("abc123", "abc124")).toBe(false);
    });

    it("returns false for different length strings", () => {
      expect(timingSafeEqual("abc", "abcd")).toBe(false);
    });
  });
});
