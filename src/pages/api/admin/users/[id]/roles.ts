import type { APIRoute } from "astro";
import { getDB } from "../../../../../lib/db";
import { hasRole } from "../../../../../lib/rbac";
import { manageRolesSchema } from "../../../../../lib/validation";

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, "Admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getDB(locals);
  const userId = params.id!;
  const body = await request.json();
  const parsed = manageRolesSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(userId)
    .first();
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { add, remove } = parsed.data;

  for (const roleName of add) {
    const role = await db
      .prepare("SELECT id FROM roles WHERE name = ?")
      .bind(roleName)
      .first<{ id: number }>();
    if (!role) {
      return new Response(
        JSON.stringify({ error: `Invalid role: ${roleName}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await db
      .prepare(
        "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
      )
      .bind(userId, role.id)
      .run();
  }

  for (const roleName of remove) {
    const role = await db
      .prepare("SELECT id FROM roles WHERE name = ?")
      .bind(roleName)
      .first<{ id: number }>();
    if (!role) {
      return new Response(
        JSON.stringify({ error: `Invalid role: ${roleName}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await db
      .prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?")
      .bind(userId, role.id)
      .run();
  }

  const rolesResult = await db
    .prepare(
      "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?"
    )
    .bind(userId)
    .all<{ name: string }>();

  return new Response(
    JSON.stringify({
      data: { roles: rolesResult.results.map((r) => r.name) },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
