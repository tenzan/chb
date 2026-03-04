import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { inviteSchema, acceptInviteSchema } from "../lib/validation";
import { sha256, toHex, randomBytes } from "../lib/crypto";
import { hashPassword } from "../lib/password";
import { generateId } from "../lib/id";
import { createSession, setSessionCookie } from "../lib/session";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

const adminInvites = new Hono<{ Bindings: Env; Variables: Variables }>();

// Accept invite is public — must come before auth middleware
adminInvites.post("/accept", async (c) => {
  const body = await c.req.json();
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const { token, name, password } = parsed.data;
  const tokenHash = await sha256(token);

  // Find valid invite
  const invite = await c.env.DB.prepare(
    `SELECT id, email, role_name FROM invites
     WHERE token_hash = ?
       AND expires_at > datetime('now')
       AND used_at IS NULL`
  )
    .bind(tokenHash)
    .first<{ id: string; email: string; role_name: string }>();

  if (!invite) {
    return c.json({ error: "Invalid, expired, or already used invite" }, 400);
  }

  // Check if user already exists
  let userId: string;
  const existingUser = await c.env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE email = ?"
  )
    .bind(invite.email)
    .first<{ id: string; password_hash: string | null }>();

  if (existingUser) {
    userId = existingUser.id;
    // Set password only if user doesn't have one
    if (!existingUser.password_hash) {
      const { hash, salt } = await hashPassword(password);
      await c.env.DB.prepare(
        "UPDATE users SET password_hash = ?, salt = ?, name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
      )
        .bind(hash, salt, name, userId)
        .run();
    }
  } else {
    userId = generateId();
    const { hash, salt } = await hashPassword(password);
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, salt, name) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(userId, invite.email, hash, salt, name)
      .run();
  }

  // Assign role
  const role = await c.env.DB.prepare(
    "SELECT id FROM roles WHERE name = ?"
  )
    .bind(invite.role_name)
    .first<{ id: number }>();

  if (role) {
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
    )
      .bind(userId, role.id)
      .run();
  }

  // Mark invite as used
  await c.env.DB.prepare(
    "UPDATE invites SET used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
  )
    .bind(invite.id)
    .run();

  // Create session
  const { token: sessionToken } = await createSession(c.env.DB, userId);

  // Get all roles
  const rolesResult = await c.env.DB.prepare(
    "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
  )
    .bind(userId)
    .all<{ name: string }>();

  const user = await c.env.DB.prepare(
    "SELECT id, email, name FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{ id: string; email: string; name: string }>();

  return c.json(
    {
      data: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        roles: rolesResult.results.map((r) => r.name),
      },
    },
    200,
    {
      "Set-Cookie": setSessionCookie(sessionToken),
    }
  );
});

// Protected routes
adminInvites.use("*", authMiddleware);

adminInvites.post("/", requireRole("Admin"), async (c) => {
  const body = await c.req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, roleName } = parsed.data;
  const user = c.get("user");

  // Check for existing active invite with same email+role
  const existing = await c.env.DB.prepare(
    `SELECT id FROM invites
     WHERE email = ? AND role_name = ?
       AND expires_at > datetime('now')
       AND used_at IS NULL`
  )
    .bind(email, roleName)
    .first();

  if (existing) {
    return c.json({ error: "Active invite already exists for this email and role" }, 409);
  }

  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const id = generateId();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO invites (id, email, role_name, token_hash, token, expires_at, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, roleName, tokenHash, rawToken, expiresAt, user.id)
    .run();

  return c.json({ data: { inviteToken: rawToken } }, 201);
});

adminInvites.get("/", requireRole("Admin"), async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT i.id, i.email, i.role_name, i.token, i.expires_at, i.used_at, i.created_at,
            u.name AS created_by_name
     FROM invites i
     JOIN users u ON i.created_by_user_id = u.id
     ORDER BY i.created_at DESC`
  ).all<{
    id: string;
    email: string;
    role_name: string;
    token: string | null;
    expires_at: string;
    used_at: string | null;
    created_at: string;
    created_by_name: string;
  }>();

  return c.json({ data: result.results });
});

adminInvites.delete("/:id", requireRole("Admin"), async (c) => {
  const inviteId = c.req.param("id");

  const invite = await c.env.DB.prepare(
    "SELECT id FROM invites WHERE id = ? AND used_at IS NULL"
  )
    .bind(inviteId)
    .first();

  if (!invite) {
    return c.json({ error: "Invite not found or already used" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM invites WHERE id = ?")
    .bind(inviteId)
    .run();

  return c.json({ data: { message: "Invite revoked" } });
});

export default adminInvites;
