import type { APIRoute } from "astro";
import { getDB } from "../../../lib/db";
import { resetPasswordSchema } from "../../../lib/validation";
import { sha256 } from "../../../lib/crypto";
import { hashPassword } from "../../../lib/password";

export const GET: APIRoute = async ({ url, locals }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const tokenHash = await sha256(token);

  const row = await db
    .prepare(
      `SELECT u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = ?
         AND prt.expires_at > datetime('now')
         AND prt.used_at IS NULL`
    )
    .bind(tokenHash)
    .first<{ email: string; name: string }>();

  if (!row) {
    return new Response(
      JSON.stringify({ error: "Invalid, expired, or already used token" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ data: { email: row.email, name: row.name } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = await sha256(token);

  const row = await db
    .prepare(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       WHERE prt.token_hash = ?
         AND prt.expires_at > datetime('now')
         AND prt.used_at IS NULL`
    )
    .bind(tokenHash)
    .first<{ id: string; user_id: string }>();

  if (!row) {
    return new Response(
      JSON.stringify({ error: "Invalid, expired, or already used token" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { hash, salt } = await hashPassword(password);

  // Update password, consume token, and revoke sessions
  await db.batch([
    db
      .prepare(
        `UPDATE users SET password_hash = ?, salt = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      )
      .bind(hash, salt, row.user_id),
    db
      .prepare(
        `UPDATE password_reset_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      )
      .bind(row.id),
    db
      .prepare(
        `UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE user_id = ? AND revoked_at IS NULL`
      )
      .bind(row.user_id),
  ]);

  return new Response(
    JSON.stringify({ data: { message: "Password has been reset" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
