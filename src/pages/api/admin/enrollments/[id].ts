import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const { id } = params;

  const existing = await db
    .prepare("SELECT id FROM enrollments WHERE id = ?")
    .bind(id!)
    .first();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Enrollment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .prepare("UPDATE enrollments SET ended_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(id!)
    .run();

  return new Response(JSON.stringify({ data: { id } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
