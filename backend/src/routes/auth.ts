import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { authMiddleware } from "../middleware/auth";
import { loginSchema } from "../lib/validation";
import { verifyPassword } from "../lib/password";
import { createSession, revokeSession, setSessionCookie, clearSessionCookie } from "../lib/session";
import { sha256 } from "../lib/crypto";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid email or password" }, 400);
  }

  const { email, password, turnstileToken } = parsed.data;

  // Verify Turnstile token (skip on localhost)
  const requestUrl = new URL(c.req.url);
  const isLocalhost = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  const turnstileSecret = c.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && !isLocalhost) {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: turnstileToken,
      }),
    });
    const verifyData = await verifyRes.json<{ success: boolean }>();
    if (!verifyData.success) {
      return c.json({ error: "Captcha verification failed" }, 400);
    }
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, password_hash, salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      name: string;
      password_hash: string | null;
      salt: string | null;
    }>();

  if (!user || !user.password_hash || !user.salt) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Get roles
  const rolesResult = await c.env.DB.prepare(
    "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
  )
    .bind(user.id)
    .all<{ name: string }>();

  const roles = rolesResult.results.map((r) => r.name);

  const { token } = await createSession(c.env.DB, user.id);

  return c.json(
    {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    },
    200,
    {
      "Set-Cookie": setSessionCookie(token),
    }
  );
});

auth.post("/logout", authMiddleware, async (c) => {
  const sessionToken = c.get("sessionToken");
  const tokenHash = await sha256(sessionToken);
  await revokeSession(c.env.DB, tokenHash);

  return c.json(
    { data: { message: "Logged out" } },
    200,
    {
      "Set-Cookie": clearSessionCookie(),
    }
  );
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ data: user });
});

export default auth;
