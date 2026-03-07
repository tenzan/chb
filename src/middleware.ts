import { defineMiddleware } from "astro:middleware";
import { validateSession } from "./lib/session";
import { bootstrapAdmin } from "./lib/bootstrap";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/accept-invite",
  "/api/auth/login",
  "/api/admin/invites/accept",
  "/api/health",
];

let bootstrapped = false;

function addSecurityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const db = context.locals.runtime.env.DB;
  const env = context.locals.runtime.env;

  // Bootstrap admin on first request
  if (!bootstrapped) {
    await bootstrapAdmin(db, env);
    bootstrapped = true;
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return addSecurityHeaders(await next());
  }

  // Validate session
  const sessionToken = context.cookies.get("session")?.value;
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/login");
  }

  const user = await validateSession(db, sessionToken);
  if (!user) {
    context.cookies.delete("session", { path: "/" });
    if (pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return context.redirect("/login");
  }

  context.locals.user = user;
  return addSecurityHeaders(await next());
});
