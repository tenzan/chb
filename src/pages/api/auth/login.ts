import type { APIRoute } from "astro";
import { getDB, getEnv } from "../../../lib/db";
import { loginSchema } from "../../../lib/validation";
import { verifyPassword } from "../../../lib/password";
import { createSession, setSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const env = getEnv(locals);
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid email or password" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, password, turnstileToken } = parsed.data;

  // Verify Turnstile token (skip on localhost)
  const requestUrl = new URL(request.url);
  const isLocalhost =
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname === "127.0.0.1";
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && !isLocalhost) {
    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      }
    );
    const verifyData = await verifyRes.json<{ success: boolean }>();
    if (!verifyData.success) {
      return new Response(
        JSON.stringify({ error: "Captcha verification failed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const user = await db
    .prepare(
      "SELECT id, email, name, password_hash, salt, status FROM users WHERE email = ?"
    )
    .bind(email)
    .first<{
      id: string;
      email: string;
      name: string;
      password_hash: string | null;
      salt: string | null;
      status: string;
    }>();

  if (!user || !user.password_hash || !user.salt) {
    return new Response(
      JSON.stringify({ error: "Invalid email or password" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (user.status === "suspended") {
    return new Response(
      JSON.stringify({ error: "Account is suspended" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (user.status === "pending") {
    return new Response(
      JSON.stringify({ error: "Account is not yet active" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Invalid email or password" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const rolesResult = await db
    .prepare(
      "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
    )
    .bind(user.id)
    .all<{ name: string }>();

  const roles = rolesResult.results.map((r) => r.name);
  const { token } = await createSession(db, user.id);

  return new Response(
    JSON.stringify({
      data: { id: user.id, email: user.email, name: user.name, roles },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setSessionCookie(token),
      },
    }
  );
};
