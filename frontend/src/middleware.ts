import type { MiddlewareHandler } from "astro";

const PUBLIC_PATHS = ["/login", "/accept-invite"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname === p + "/");
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;

  if (isPublicPath(pathname)) {
    return next();
  }

  const cookie = context.request.headers.get("cookie");
  if (!cookie || !cookie.includes("session=")) {
    return context.redirect("/login");
  }

  const apiUrl = import.meta.env.PUBLIC_API_URL || "http://localhost:8787";

  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });

    if (!res.ok) {
      return context.redirect("/login");
    }

    const { data } = await res.json();
    context.locals.user = data;
  } catch {
    return context.redirect("/login");
  }

  const response = await next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
};
