import { sha256, toHex, randomBytes } from "./crypto";
import { generateId } from "./id";
import type { AuthUser } from "../types/api";

const SESSION_EXPIRY_DAYS = 30;

export async function createSession(
  db: D1Database,
  userId: string
): Promise<{ token: string; sessionId: string }> {
  const rawToken = toHex(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const sessionId = generateId();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
    )
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run();

  return { token: rawToken, sessionId };
}

export async function validateSession(
  db: D1Database,
  token: string
): Promise<AuthUser | null> {
  const tokenHash = await sha256(token);

  const row = await db
    .prepare(
      `SELECT s.id as session_id, u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ?
         AND s.expires_at > datetime('now')
         AND s.revoked_at IS NULL`
    )
    .bind(tokenHash)
    .first<{
      session_id: string;
      id: string;
      email: string;
      name: string;
    }>();

  if (!row) return null;

  // Fetch roles
  const rolesResult = await db
    .prepare(
      `SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`
    )
    .bind(row.id)
    .all<{ name: string }>();

  const roles = rolesResult.results.map((r) => r.name);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles,
  };
}

export async function revokeSession(
  db: D1Database,
  tokenHash: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE token_hash = ?"
    )
    .bind(tokenHash)
    .run();
}

export function setSessionCookie(token: string): string {
  return `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_EXPIRY_DAYS * 24 * 60 * 60}`;
}

export function clearSessionCookie(): string {
  return `session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}
