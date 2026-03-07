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
  const inviteId = params.id!;

  const invite = await db
    .prepare("SELECT id FROM invites WHERE id = ? AND used_at IS NULL")
    .bind(inviteId)
    .first();

  if (!invite) {
    return new Response(
      JSON.stringify({ error: "Invite not found or already used" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  await db.prepare("DELETE FROM invites WHERE id = ?").bind(inviteId).run();

  return new Response(
    JSON.stringify({ data: { message: "Invite revoked" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
