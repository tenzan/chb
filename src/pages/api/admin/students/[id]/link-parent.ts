import type { APIRoute } from "astro";
import { getDB } from "../../../../../lib/db";
import { hasRole } from "../../../../../lib/rbac";

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const studentId = params.id!;
  const body = await request.json();
  const parentUserId = body.parentUserId;

  if (!parentUserId) {
    return new Response(
      JSON.stringify({ error: "parentUserId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await db
    .prepare(
      "SELECT parent_user_id FROM parent_students WHERE parent_user_id = ? AND student_id = ?"
    )
    .bind(parentUserId, studentId)
    .first();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "Link already exists" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  await db
    .prepare(
      "INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)"
    )
    .bind(parentUserId, studentId)
    .run();

  return new Response(
    JSON.stringify({ data: { message: "Parent linked to student" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
