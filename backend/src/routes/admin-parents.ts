import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createParentSchema } from "../lib/validation";
import { generateId } from "../lib/id";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

const adminParents = new Hono<{ Bindings: Env; Variables: Variables }>();

adminParents.use("*", authMiddleware);

adminParents.post("/", requireRole("Admin"), async (c) => {
  const body = await c.req.json();
  const parsed = createParentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, name, phone, note } = parsed.data;

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

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, phone, note) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, email, name, phone || null, note || null)
    .run();

  // Assign Parent role
  const role = await c.env.DB.prepare(
    "SELECT id FROM roles WHERE name = 'Parent'"
  ).first<{ id: number }>();

  if (role) {
    await c.env.DB.prepare(
      "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)"
    )
      .bind(id, role.id)
      .run();
  }

  return c.json({
    data: { id, email, name, phone: phone || null, note: note || null, roles: ["Parent"] },
  }, 201);
});

adminParents.get("/", requireRole("Admin"), async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.note, u.created_at
     FROM users u
     JOIN user_roles ur ON u.id = ur.user_id
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name = 'Parent'
     ORDER BY u.created_at DESC`
  ).all<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    note: string | null;
    created_at: string;
  }>();

  return c.json({ data: result.results });
});

export default adminParents;
