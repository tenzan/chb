import { existsSync, readFileSync } from "node:fs";

const BASE_URL = "http://localhost:4322";

// The dev server bootstraps the admin from .dev.vars, so log in with the same
// values (env vars take precedence, e.g. in CI).
function readDevVars(): Record<string, string> {
  if (!existsSync(".dev.vars")) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(".dev.vars", "utf-8").split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

export async function bootstrapAdmin(): Promise<{
  email: string;
  password: string;
}> {
  const devVars = readDevVars();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? devVars.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? devVars.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD not set (env or .dev.vars)");
  }
  return { email, password };
}

export async function loginAsAdmin(): Promise<string> {
  const { email, password } = await bootstrapAdmin();

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("No session cookie returned");
  }

  const match = setCookie.match(/session=([^;]+)/);
  if (!match) {
    throw new Error("Could not extract session token");
  }

  return match[1];
}

export async function getSessionCookie(): Promise<{
  name: string;
  value: string;
  domain: string;
  path: string;
}> {
  const token = await loginAsAdmin();
  return {
    name: "session",
    value: token,
    domain: "localhost",
    path: "/",
  };
}

export async function createParentViaApi(
  sessionToken: string,
  data: { email: string; name: string; phone?: string }
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch(`${BASE_URL}/api/admin/parents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session=${sessionToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Create parent failed: ${res.status}`);
  }

  const body = await res.json();
  return body.data;
}
