import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { acceptInviteSchema } from "../../../../lib/validation";
import { sha256 } from "../../../../lib/crypto";
import { hashPassword } from "../../../../lib/password";
import { generateId } from "../../../../lib/id";
import { createSession, setSessionCookie } from "../../../../lib/session";

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const body = await request.json();
  const parsed = acceptInviteSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, name, password } = parsed.data;
  const tokenHash = await sha256(token);

  const invite = await db
    .prepare(
      `SELECT id, email, role_name FROM invites
       WHERE token_hash = ?
         AND expires_at > datetime('now')
         AND used_at IS NULL`
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; role_name: string }>();

  if (!invite) {
    return new Response(
      JSON.stringify({ error: "Invalid, expired, or already used invite" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let userId: string;
  const existingUser = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(invite.email)
    .first<{ id: string; password_hash: string | null }>();

  if (existingUser) {
    userId = existingUser.id;
    if (!existingUser.password_hash) {
      const { hash, salt } = await hashPassword(password);
      await db
        .prepare(
          "UPDATE users SET password_hash = ?, salt = ?, name = ?, status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
        )
        .bind(hash, salt, name, userId)
        .run();
    } else {
      // Existing user with password — just ensure active
      await db
        .prepare(
          "UPDATE users SET status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
        )
        .bind(userId)
        .run();
    }
  } else {
    userId = generateId();
    const { hash, salt } = await hashPassword(password);
    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, salt, name, status) VALUES (?, ?, ?, ?, ?, 'active')`
      )
      .bind(userId, invite.email, hash, salt, name)
      .run();
  }

  const role = await db
    .prepare("SELECT id FROM roles WHERE name = ?")
    .bind(invite.role_name)
    .first<{ id: number }>();

  if (role) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
      )
      .bind(userId, role.id)
      .run();
  }

  await db
    .prepare(
      "UPDATE invites SET used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
    )
    .bind(invite.id)
    .run();

  const { token: sessionToken } = await createSession(db, userId);

  const rolesResult = await db
    .prepare(
      "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
    )
    .bind(userId)
    .all<{ name: string }>();

  const user = await db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  return new Response(
    JSON.stringify({
      data: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        roles: rolesResult.results.map((r) => r.name),
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setSessionCookie(sessionToken),
      },
    }
  );
};
