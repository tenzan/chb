import { createMiddleware } from "hono/factory";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";

type Variables = {
  user: AuthUser;
};

export const requireRole = (...roles: string[]) =>
  createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const user = c.get("user");
    const hasRole = user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
