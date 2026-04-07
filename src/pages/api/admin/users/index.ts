import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createUserSchema } from "../../../../lib/validation";
import { hashPassword } from "../../../../lib/password";
import { generateId } from "../../../../lib/id";

function isPlaceholderEmail(email: string): boolean {
  return email.endsWith("@parent.local") || email.endsWith("@student.local");
}

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
      `SELECT u.id, u.email, u.name, u.phone, u.birthday, u.description, u.note, u.status, u.created_at, u.updated_at
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all<{
      id: string;
      email: string;
      name: string;
      phone: string | null;
      birthday: string | null;
      description: string | null;
      note: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>();

  const users = await Promise.all(
    result.results.map(async (u) => {
      const rolesResult = await db
        .prepare(
          "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
        )
        .bind(u.id)
        .all<{ name: string }>();

      const roles = rolesResult.results.map((r) => r.name);

      // For students, fetch linked parents
      let parents: Array<{ id: string; name: string; email: string | null }> = [];
      if (roles.includes("Student")) {
        const parentsResult = await db
          .prepare(
            `SELECT u.id, u.name, u.email FROM users u
             JOIN parent_students ps ON u.id = ps.parent_id
             WHERE ps.student_id = ?`
          )
          .bind(u.id)
          .all<{ id: string; name: string; email: string }>();
        parents = parentsResult.results.map((p) => ({
          ...p,
          email: isPlaceholderEmail(p.email) ? null : p.email,
        }));
      }

      // For pending users, fetch the active invite ID
      let inviteId: string | undefined;
      if (u.status === "pending") {
        const invite = await db
          .prepare(
            "SELECT id FROM invites WHERE email = ? AND used_at IS NULL AND expires_at > datetime('now') LIMIT 1"
          )
          .bind(u.email)
          .first<{ id: string }>();
        if (invite) inviteId = invite.id;
      }

      // Hide internal placeholder emails ({id}@parent.local, {id}@student.local)
      // from API responses — they exist only to satisfy the NOT NULL constraint.
      const displayEmail = isPlaceholderEmail(u.email) ? null : u.email;

      return { ...u, email: displayEmail, roles, parents, ...(inviteId ? { inviteId } : {}) };
    })
  );

  return new Response(JSON.stringify({ data: users }), {
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
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { email, name, password, roles, phone, note } = parsed.data;

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
  const { hash, salt } = await hashPassword(password);

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, salt, name, phone, note) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, email, hash, salt, name, phone || null, note || null)
    .run();

  for (const roleName of roles) {
    const role = await db
      .prepare("SELECT id FROM roles WHERE name = ?")
      .bind(roleName)
      .first<{ id: number }>();
    if (role) {
      await db
        .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
        .bind(id, role.id)
        .run();
    }
  }

  return new Response(
    JSON.stringify({ data: { id, email, name, roles } }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
