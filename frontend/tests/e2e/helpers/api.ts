const API_URL = "http://localhost:8787";

export async function bootstrapAdmin(): Promise<{
  email: string;
  password: string;
}> {
  // The backend will auto-bootstrap admin from env vars
  // We just need to return the credentials
  return {
    email: "admin@test.com",
    password: "TestPassword123!",
  };
}

export async function loginAsAdmin(): Promise<string> {
  const { email, password } = await bootstrapAdmin();

  const res = await fetch(`${API_URL}/api/auth/login`, {
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

  // Extract session token
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
  data: { email: string; name: string }
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch(`${API_URL}/api/admin/parents`, {
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
