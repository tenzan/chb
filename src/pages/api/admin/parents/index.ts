import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createParentSchema } from "../../../../lib/validation";
import { generateId } from "../../../../lib/id";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const result = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.note, u.created_at
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE r.name = 'Parent'
       ORDER BY u.created_at DESC`
    )
    .all<{
      id: string;
      email: string;
      name: string;
      phone: string | null;
      note: string | null;
      created_at: string;
    }>();

  return new Response(JSON.stringify({ data: result.results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const body = await request.json();
  const parsed = createParentSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { email, name, phone, note } = parsed.data;

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "User with this email already exists" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = generateId();

  await db
    .prepare(
      `INSERT INTO users (id, email, name, phone, note) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, email, name, phone || null, note || null)
    .run();

  const role = await db
    .prepare("SELECT id FROM roles WHERE name = 'Parent'")
    .first<{ id: number }>();

  if (role) {
    await db
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(id, role.id)
      .run();
  }

  return new Response(
    JSON.stringify({
      data: {
        id,
        email,
        name,
        phone: phone || null,
        note: note || null,
        roles: ["Parent"],
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
