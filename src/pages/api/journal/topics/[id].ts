import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { JOURNAL_ROLES, json } from "../../../../lib/journal";

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  const existing = await db.prepare("SELECT id FROM topics WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Topic not found" }, 404);

  await db.prepare("DELETE FROM topics WHERE id = ?").bind(id).run();
  return json({ data: { id } });
};
