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

  // Hide placeholder emails ({id}@parent.local) from API responses — they
  // are an internal implementation detail to satisfy the NOT NULL constraint
  // on users.email, not real addresses.
  const parents = (result.results || []).map((p) => ({
    ...p,
    email: p.email.endsWith("@parent.local") ? null : p.email,
  }));

  return new Response(JSON.stringify({ data: parents }), {
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

  // Only check for duplicates when an email is provided — parents without
  // an email get a unique placeholder `{id}@parent.local`.
  if (email) {
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
  }

  const id = generateId();
  const storedEmail = email ?? `${id}@parent.local`;

  await db
    .prepare(
      `INSERT INTO users (id, email, name, phone, note) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, storedEmail, name, phone || null, note || null)
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
        email: email ?? null,
        name,
        phone: phone || null,
        note: note || null,
        roles: ["Parent"],
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
