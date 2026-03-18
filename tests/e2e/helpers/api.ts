const BASE_URL = "http://localhost:4322";

export async function bootstrapAdmin(): Promise<{
  email: string;
  password: string;
}> {
  return {
    email: "askar75@gmail.com",
    password: "draJAMU7",
  };
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
