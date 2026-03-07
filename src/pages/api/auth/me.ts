import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  return new Response(JSON.stringify({ data: locals.user }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
