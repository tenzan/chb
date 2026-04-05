import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createAttendanceSchema } from "../../../../lib/validation";
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
  const month = url.searchParams.get("month");

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
  if (month) {
    whereClauses.push("a.date LIKE ?");
    bindings.push(month + "%");
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const result = await db
    .prepare(
      `SELECT a.id, a.enrollment_id, a.date, a.status, a.note,
              a.recorded_by, a.created_at, a.updated_at,
              s.name AS subject_name, s.id AS subject_id,
              u.name AS student_name, u.id AS student_id
       FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
       JOIN subjects s ON s.id = e.subject_id
       JOIN users u ON u.id = e.student_id
       ${whereSQL}
       ORDER BY a.date ASC`
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
  const parsed = createAttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { enrollment_id, date, status, note } = parsed.data;

  // Check enrollment exists
  const enrollment = await db
    .prepare("SELECT id FROM enrollments WHERE id = ?")
    .bind(enrollment_id)
    .first();
  if (!enrollment) {
    return new Response(
      JSON.stringify({ error: "Enrollment not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const recordedBy = locals.user!.id;

  // Check if attendance already exists for this enrollment+date
  const existing = await db
    .prepare("SELECT id FROM attendance WHERE enrollment_id = ? AND date = ?")
    .bind(enrollment_id, date)
    .first<{ id: string }>();

  if (existing) {
    // Update existing record
    await db
      .prepare(
        `UPDATE attendance SET status = ?, note = ?, recorded_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
      )
      .bind(status, note || null, recordedBy, existing.id)
      .run();

    const updated = await db
      .prepare(
        `SELECT id, enrollment_id, date, status, note, recorded_by, created_at, updated_at FROM attendance WHERE id = ?`
      )
      .bind(existing.id)
      .first();

    return new Response(JSON.stringify({ data: updated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Insert new record
  const id = generateId();

  await db
    .prepare(
      "INSERT INTO attendance (id, enrollment_id, date, status, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, enrollment_id, date, status, note || null, recordedBy)
    .run();

  return new Response(
    JSON.stringify({
      data: { id, enrollment_id, date, status, note: note || null, recorded_by: recordedBy },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
