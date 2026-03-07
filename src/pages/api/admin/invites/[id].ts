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

  // Get the invite email before deleting
  const inviteData = await db
    .prepare("SELECT email FROM invites WHERE id = ?")
    .bind(inviteId)
    .first<{ email: string }>();

  await db.prepare("DELETE FROM invites WHERE id = ?").bind(inviteId).run();

  // If there's a pending user with this email and no other active invites, delete the pending user
  if (inviteData) {
    const otherInvite = await db
      .prepare(
        "SELECT id FROM invites WHERE email = ? AND used_at IS NULL AND expires_at > datetime('now')"
      )
      .bind(inviteData.email)
      .first();

    if (!otherInvite) {
      await db
        .prepare("DELETE FROM users WHERE email = ? AND status = 'pending'")
        .bind(inviteData.email)
        .run();
    }
  }

  return new Response(
    JSON.stringify({ data: { message: "Invite revoked" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
