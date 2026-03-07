import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { inviteSchema } from "../../../../lib/validation";
import { sha256, toHex, randomBytes } from "../../../../lib/crypto";
import { generateId } from "../../../../lib/id";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const result = await db
    .prepare(
      `SELECT i.id, i.email, i.role_name, i.token, i.expires_at, i.used_at, i.created_at,
              u.name AS created_by_name
       FROM invites i
       JOIN users u ON i.created_by_user_id = u.id
       ORDER BY i.created_at DESC`
    )
    .all<{
      id: string;
      email: string;
      role_name: string;
      token: string | null;
      expires_at: string;
      used_at: string | null;
      created_at: string;
      created_by_name: string;
    }>();

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
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { email, roleName } = parsed.data;
  const user = locals.user!;

  const existing = await db
    .prepare(
      `SELECT id FROM invites
       WHERE email = ? AND role_name = ?
         AND expires_at > datetime('now')
         AND used_at IS NULL`
    )
    .bind(email, roleName)
    .first();

  if (existing) {
    return new Response(
      JSON.stringify({
        error: "Active invite already exists for this email and role",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(
      `INSERT INTO invites (id, email, role_name, token_hash, token, expires_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, email, roleName, tokenHash, rawToken, expiresAt, user.id)
    .run();

  return new Response(
    JSON.stringify({ data: { inviteToken: rawToken } }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
