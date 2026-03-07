import type { APIRoute } from "astro";
import { getDB } from "../../../lib/db";
import { sha256 } from "../../../lib/crypto";
import { revokeSession, clearSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ cookies, locals }) => {
  const db = getDB(locals);
  const sessionToken = cookies.get("session")?.value;

  if (!sessionToken) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const tokenHash = await sha256(sessionToken);
  await revokeSession(db, tokenHash);

  return new Response(
    JSON.stringify({ data: { message: "Logged out" } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    }
  );
};
