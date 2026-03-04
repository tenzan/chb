import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles } from "./helpers/setup";
import { bootstrapAdmin } from "../src/lib/bootstrap";
import { verifyPassword } from "../src/lib/password";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

describe("bootstrapAdmin", () => {
  it("creates admin user if no Admin exists and env vars are set", async () => {
    const testEnv = {
      DB: env.DB,
      BASE_URL: "http://localhost:8787",
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(testEnv.DB, testEnv);

    const user = await env.DB.prepare(
      "SELECT id, email, name FROM users WHERE email = ?"
    )
      .bind("admin@test.com")
      .first<{ id: string; email: string; name: string }>();

    expect(user).not.toBeNull();
    expect(user!.email).toBe("admin@test.com");
  });

  it("does not create if Admin already exists", async () => {
    const testEnv = {
      DB: env.DB,
      BASE_URL: "http://localhost:8787",
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    // Create first admin
    await bootstrapAdmin(testEnv.DB, testEnv);

    // Try again — should not create duplicate
    await bootstrapAdmin(testEnv.DB, testEnv);

    const count = await env.DB.prepare("SELECT COUNT(*) as c FROM users")
      .first<{ c: number }>();
    expect(count!.c).toBe(1);
  });

  it("hashes the password properly", async () => {
    const testEnv = {
      DB: env.DB,
      BASE_URL: "http://localhost:8787",
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(testEnv.DB, testEnv);

    const user = await env.DB.prepare(
      "SELECT password_hash, salt FROM users WHERE email = ?"
    )
      .bind("admin@test.com")
      .first<{ password_hash: string; salt: string }>();

    expect(user).not.toBeNull();
    const valid = await verifyPassword("AdminPass123!", user!.password_hash, user!.salt);
    expect(valid).toBe(true);
  });

  it("assigns Admin role", async () => {
    const testEnv = {
      DB: env.DB,
      BASE_URL: "http://localhost:8787",
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(testEnv.DB, testEnv);

    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    )
      .bind("admin@test.com")
      .first<{ id: string }>();

    const roles = await env.DB.prepare(
      "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
    )
      .bind(user!.id)
      .all<{ name: string }>();

    expect(roles.results.map((r) => r.name)).toContain("Admin");
  });
});
