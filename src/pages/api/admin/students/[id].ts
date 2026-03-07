import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { updateStudentSchema } from "../../../../lib/validation";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const studentId = params.id!;
  const body = await request.json();
  const parsed = updateStudentSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = await db
    .prepare("SELECT id FROM students WHERE id = ?")
    .bind(studentId)
    .first();
  if (!existing) {
    return new Response(JSON.stringify({ error: "Student not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    values.push(updates.name);
  }
  if (updates.birthday !== undefined) {
    setClauses.push("birthday = ?");
    values.push(updates.birthday);
  }
  if (updates.description !== undefined) {
    setClauses.push("description = ?");
    values.push(updates.description);
  }
  if (updates.note !== undefined) {
    setClauses.push("note = ?");
    values.push(updates.note);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    await db
      .prepare(`UPDATE students SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values, studentId)
      .run();
  }

  const student = await db
    .prepare(
      "SELECT id, name, birthday, description, note, created_at, updated_at FROM students WHERE id = ?"
    )
    .bind(studentId)
    .first<{
      id: string;
      name: string;
      birthday: string | null;
      description: string | null;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return new Response(JSON.stringify({ data: student }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
