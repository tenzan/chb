import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { manageRolesSchema, createUserSchema } from "../lib/validation";
import { hashPassword } from "../lib/password";
import { generateId } from "../lib/id";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

const adminUsers = new Hono<{ Bindings: Env; Variables: Variables }>();

adminUsers.use("*", authMiddleware);

adminUsers.get("/", requireRole("Admin"), async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.note, u.created_at, u.updated_at
     FROM users u
     ORDER BY u.created_at DESC`
  ).all<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
  }>();

  // Fetch roles for all users
  const users = await Promise.all(
    result.results.map(async (u) => {
      const rolesResult = await c.env.DB.prepare(
        "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
      )
        .bind(u.id)
        .all<{ name: string }>();
      return {
        ...u,
        roles: rolesResult.results.map((r) => r.name),
      };
    })
  );

  return c.json({ data: users });
});

adminUsers.post("/", requireRole("Admin"), async (c) => {
  const body = await c.req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, name, password, roles, phone, note } = parsed.data;

  // Check if user already exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  )
    .bind(email)
    .first();
  if (existing) {
    return c.json({ error: "User with this email already exists" }, 409);
  }

  const id = generateId();
  const { hash, salt } = await hashPassword(password);

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, name, phone, note) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, hash, salt, name, phone || null, note || null)
    .run();

  // Assign roles
  for (const roleName of roles) {
    const role = await c.env.DB.prepare(
      "SELECT id FROM roles WHERE name = ?"
    )
      .bind(roleName)
      .first<{ id: number }>();
    if (role) {
      await c.env.DB.prepare(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)"
      )
        .bind(id, role.id)
        .run();
    }
  }

  return c.json({
    data: { id, email, name, roles },
  }, 201);
});

adminUsers.post("/:id/roles", requireRole("Admin"), async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json();
  const parsed = manageRolesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  // Check user exists
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE id = ?"
  )
    .bind(userId)
    .first();
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const { add, remove } = parsed.data;

  // Add roles
  for (const roleName of add) {
    const role = await c.env.DB.prepare(
      "SELECT id FROM roles WHERE name = ?"
    )
      .bind(roleName)
      .first<{ id: number }>();
    if (!role) {
      return c.json({ error: `Invalid role: ${roleName}` }, 400);
    }
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
    )
      .bind(userId, role.id)
      .run();
  }

  // Remove roles
  for (const roleName of remove) {
    const role = await c.env.DB.prepare(
      "SELECT id FROM roles WHERE name = ?"
    )
      .bind(roleName)
      .first<{ id: number }>();
    if (!role) {
      return c.json({ error: `Invalid role: ${roleName}` }, 400);
    }
    await c.env.DB.prepare(
      "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?"
    )
      .bind(userId, role.id)
      .run();
  }

  // Return updated roles
  const rolesResult = await c.env.DB.prepare(
    "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
  )
    .bind(userId)
    .all<{ name: string }>();

  return c.json({
    data: { roles: rolesResult.results.map((r) => r.name) },
  });
});

export default adminUsers;
