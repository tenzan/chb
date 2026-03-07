import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles } from "../setup/seed";
import { bootstrapAdmin } from "../../src/lib/bootstrap";
import { verifyPassword } from "../../src/lib/password";

describe("bootstrapAdmin", () => {
  it("creates admin user if no Admin exists and env vars are set", async () => {
    await seedRoles();
    const db = getTestDB();
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(db, env);

    const user = await db
      .prepare("SELECT id, email, name FROM users WHERE email = ?")
      .bind("admin@test.com")
      .first<{ id: string; email: string; name: string }>();

    expect(user).not.toBeNull();
    expect(user!.email).toBe("admin@test.com");
  });

  it("does not create if Admin already exists", async () => {
    await seedRoles();
    const db = getTestDB();
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(db, env);
    await bootstrapAdmin(db, env);

    const count = await db
      .prepare("SELECT COUNT(*) as c FROM users")
      .first<{ c: number }>();
    expect(count!.c).toBe(1);
  });

  it("hashes the password properly", async () => {
    await seedRoles();
    const db = getTestDB();
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(db, env);

    const user = await db
      .prepare("SELECT password_hash, salt FROM users WHERE email = ?")
      .bind("admin@test.com")
      .first<{ password_hash: string; salt: string }>();

    expect(user).not.toBeNull();
    const valid = await verifyPassword(
      "AdminPass123!",
      user!.password_hash,
      user!.salt
    );
    expect(valid).toBe(true);
  });

  it("assigns Admin role", async () => {
    await seedRoles();
    const db = getTestDB();
    const env = {
      BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!",
    };

    await bootstrapAdmin(db, env);

    const user = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind("admin@test.com")
      .first<{ id: string }>();

    const roles = await db
      .prepare(
        "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
      )
      .bind(user!.id)
      .all<{ name: string }>();

    expect(roles.results.map((r) => r.name)).toContain("Admin");
  });
});
