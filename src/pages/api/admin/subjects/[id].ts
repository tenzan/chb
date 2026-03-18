import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { updateSubjectSchema } from "../../../../lib/validation";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const { id } = params;

  const existing = await db
    .prepare("SELECT id, name, description FROM subjects WHERE id = ?")
    .bind(id!)
    .first<{ id: string; name: string; description: string | null }>();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Subject not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const parsed = updateSubjectSchema.safeParse(body);

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

  if (name && name !== existing.name) {
    const duplicate = await db
      .prepare("SELECT id FROM subjects WHERE name = ? AND id != ?")
      .bind(name, id!)
      .first();
    if (duplicate) {
      return new Response(
        JSON.stringify({ error: "Subject with this name already exists" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const setClauses: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    setClauses.push("name = ?");
    values.push(name);
  }
  if (description !== undefined) {
    setClauses.push("description = ?");
    values.push(description);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    values.push(id!);

    await db
      .prepare(
        `UPDATE subjects SET ${setClauses.join(", ")} WHERE id = ?`
      )
      .bind(...values)
      .run();
  }

  const updated = await db
    .prepare("SELECT id, name, description, created_at, updated_at FROM subjects WHERE id = ?")
    .bind(id!)
    .first<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return new Response(JSON.stringify({ data: updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const { id } = params;

  const existing = await db
    .prepare("SELECT id FROM subjects WHERE id = ?")
    .bind(id!)
    .first();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Subject not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db.prepare("DELETE FROM subjects WHERE id = ?").bind(id!).run();

  return new Response(JSON.stringify({ data: { id } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
