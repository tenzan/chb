import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createStudentSchema } from "../../../../lib/validation";
import { generateId } from "../../../../lib/id";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const parentUserId = url.searchParams.get("parentUserId");

  let query: string;

  if (parentUserId) {
    query = `SELECT u.id, u.name, u.birthday, u.description, u.note, u.created_at, u.updated_at
             FROM users u
             JOIN user_roles ur ON u.id = ur.user_id
             JOIN roles r ON ur.role_id = r.id
             JOIN parent_students ps ON u.id = ps.student_id
             WHERE r.name = 'Student' AND ps.parent_id = ?
             ORDER BY u.created_at DESC`;
  } else {
    query = `SELECT u.id, u.name, u.birthday, u.description, u.note, u.created_at, u.updated_at
             FROM users u
             JOIN user_roles ur ON u.id = ur.user_id
             JOIN roles r ON ur.role_id = r.id
             WHERE r.name = 'Student'
             ORDER BY u.created_at DESC`;
  }

  const stmt = db.prepare(query);
  const result = parentUserId
    ? await stmt.bind(parentUserId).all<{
        id: string;
        name: string;
        birthday: string | null;
        description: string | null;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>()
    : await stmt.all<{
        id: string;
        name: string;
        birthday: string | null;
        description: string | null;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>();

  const students = await Promise.all(
    result.results.map(async (s) => {
      const parentsResult = await db
        .prepare(
          `SELECT u.id, u.name, u.email FROM users u
           JOIN parent_students ps ON u.id = ps.parent_id
           WHERE ps.student_id = ?`
        )
        .bind(s.id)
        .all<{ id: string; name: string; email: string }>();

      return {
        ...s,
        parents: parentsResult.results,
      };
    })
  );

  return new Response(JSON.stringify({ data: students }), {
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
  const parsed = createStudentSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, parentUserId, birthday, description, note } = parsed.data;

  const parent = await db
    .prepare(
      `SELECT u.id FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ? AND r.name = 'Parent'`
    )
    .bind(parentUserId)
    .first();

  if (!parent) {
    return new Response(
      JSON.stringify({
        error: "Parent user not found or does not have Parent role",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = generateId();

  await db
    .prepare(
      `INSERT INTO users (id, email, name, birthday, description, note) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, `${id}@student.local`, name, birthday || null, description || null, note || null)
    .run();

  const role = await db
    .prepare("SELECT id FROM roles WHERE name = 'Student'")
    .first<{ id: number }>();

  if (role) {
    await db
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(id, role.id)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO parent_students (parent_id, student_id) VALUES (?, ?)`
    )
    .bind(parentUserId, id)
    .run();

  return new Response(
    JSON.stringify({
      data: {
        id,
        name,
        birthday: birthday || null,
        description: description || null,
        note: note || null,
        parentUserId,
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
