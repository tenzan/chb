import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { createSubjectSchema } from "../../../../lib/validation";
import { generateId } from "../../../../lib/id";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const result = await db
    .prepare(
      `SELECT id, name, description, created_at, updated_at
       FROM subjects
       ORDER BY name ASC`
    )
    .all<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return new Response(JSON.stringify({ data: result.results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const body = await request.json();
  const parsed = createSubjectSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, description } = parsed.data;

  const existing = await db
    .prepare("SELECT id FROM subjects WHERE name = ?")
    .bind(name)
    .first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "Subject with this name already exists" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = generateId();

  await db
    .prepare(
      `INSERT INTO subjects (id, name, description) VALUES (?, ?, ?)`
    )
    .bind(id, name, description || null)
    .run();

  return new Response(
    JSON.stringify({
      data: {
        id,
        name,
        description: description || null,
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
