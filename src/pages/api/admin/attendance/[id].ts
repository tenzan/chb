import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { updateAttendanceSchema } from "../../../../lib/validation";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const { id } = params;

  const existing = await db
    .prepare("SELECT id FROM attendance WHERE id = ?")
    .bind(id!)
    .first();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Attendance record not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const parsed = updateAttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { status, note } = parsed.data;

  const setClauses: string[] = [];
  const values: any[] = [];

  if (status !== undefined) {
    setClauses.push("status = ?");
    values.push(status);
  }
  if (note !== undefined) {
    setClauses.push("note = ?");
    values.push(note);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    values.push(id!);

    await db
      .prepare(
        `UPDATE attendance SET ${setClauses.join(", ")} WHERE id = ?`
      )
      .bind(...values)
      .run();
  }

  const updated = await db
    .prepare(
      `SELECT id, enrollment_id, date, status, note, recorded_by, created_at, updated_at FROM attendance WHERE id = ?`
    )
    .bind(id!)
    .first();

  return new Response(JSON.stringify({ data: updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
