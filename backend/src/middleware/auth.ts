import { createMiddleware } from "hono/factory";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { validateSession } from "../lib/session";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const cookie = c.req.header("Cookie");
  if (!cookie) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const sessionToken = parseCookie(cookie, "session");
  if (!sessionToken) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const user = await validateSession(c.env.DB, sessionToken);
  if (!user) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  c.set("user", user);
  c.set("sessionToken", sessionToken);
  await next();
});

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
