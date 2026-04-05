import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createEnrollmentSchema } from "../../../../lib/validation";
import { generateId } from "../../../../lib/id";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const studentId = url.searchParams.get("student_id");
  const subjectId = url.searchParams.get("subject_id");

  const whereClauses: string[] = [];
  const bindings: string[] = [];

  if (studentId) {
    whereClauses.push("e.student_id = ?");
    bindings.push(studentId);
  }
  if (subjectId) {
    whereClauses.push("e.subject_id = ?");
    bindings.push(subjectId);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const result = await db
    .prepare(
      `SELECT e.id, e.student_id, e.subject_id, u.name AS student_name,
              s.name AS subject_name, e.started_at, e.ended_at, e.created_at
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       JOIN subjects s ON s.id = e.subject_id
       ${whereSQL}
       ORDER BY u.name ASC, s.name ASC`
    )
    .bind(...bindings)
    .all();

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
  const parsed = createEnrollmentSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { student_id, subject_id } = parsed.data;

  const student = await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(student_id)
    .first();
  if (!student) {
    return new Response(
      JSON.stringify({ error: "Student not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const subject = await db
    .prepare("SELECT id FROM subjects WHERE id = ?")
    .bind(subject_id)
    .first();
  if (!subject) {
    return new Response(
      JSON.stringify({ error: "Subject not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await db
    .prepare("SELECT id FROM enrollments WHERE student_id = ? AND subject_id = ?")
    .bind(student_id, subject_id)
    .first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "Enrollment already exists" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = generateId();

  await db
    .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
    .bind(id, student_id, subject_id)
    .run();

  return new Response(
    JSON.stringify({
      data: { id, student_id, subject_id },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
