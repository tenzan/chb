import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { generatePasswordResetSchema } from "../../../../lib/validation";
import { sha256, toHex, randomBytes } from "../../../../lib/crypto";
import { generateId } from "../../../../lib/id";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const body = await request.json();
  const parsed = generatePasswordResetSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { userId } = parsed.data;

  const user = await db
    .prepare("SELECT id, status FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; status: string }>();

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (user.status === "pending") {
    return new Response(
      JSON.stringify({ error: "Cannot reset password for a pending user. Use the invite flow instead." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Invalidate any existing unused tokens for this user
  await db
    .prepare(
      `UPDATE password_reset_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE user_id = ? AND used_at IS NULL`
    )
    .bind(userId)
    .run();

  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, userId, tokenHash, expiresAt, locals.user!.id)
    .run();

  return new Response(
    JSON.stringify({ data: { resetToken: rawToken } }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
