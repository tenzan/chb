import { env } from "cloudflare:test";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,

  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, salt TEXT, name TEXT NOT NULL, phone TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`,

  `CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE, UNIQUE(user_id, role_id))`,

  `CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT NOT NULL, birthday TEXT, description TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`,

  `CREATE TABLE IF NOT EXISTS parent_students (parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), UNIQUE(parent_user_id, student_id))`,

  `CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, email TEXT NOT NULL, role_name TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_by_user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`,

  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))`,
];

export async function applyMigrations() {
  for (const stmt of STATEMENTS) {
    await env.DB.prepare(stmt).run();
  }
}

export async function seedRoles() {
  const roles = ["Admin", "Personnel", "Tutor", "Accountant", "Parent"];
  for (const role of roles) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO roles (name) VALUES (?)`
    )
      .bind(role)
      .run();
  }
}

export async function clearTables() {
  const tables = [
    "sessions",
    "invites",
    "parent_students",
    "students",
    "user_roles",
    "users",
    "roles",
  ];
  for (const table of tables) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
}

export async function createTestUser(
  options: {
    id?: string;
    email?: string;
    name?: string;
    passwordHash?: string;
    salt?: string;
    roles?: string[];
  } = {}
) {
  const {
    id = crypto.randomUUID(),
    email = "test@example.com",
    name = "Test User",
    passwordHash = "fakehash",
    salt = "fakesalt",
    roles = [],
  } = options;

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, name) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, email, passwordHash, salt, name)
    .run();

  for (const roleName of roles) {
    const role = await env.DB.prepare(
      `SELECT id FROM roles WHERE name = ?`
    )
      .bind(roleName)
      .first<{ id: number }>();
    if (role) {
      await env.DB.prepare(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`
      )
        .bind(id, role.id)
        .run();
    }
  }

  return { id, email, name };
}
