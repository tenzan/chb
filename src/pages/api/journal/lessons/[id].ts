import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { updateLessonSchema } from "../../../../lib/validation";
import { JOURNAL_ROLES, json, validationError, getLesson } from "../../../../lib/journal";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  if (!(await getLesson(db, id))) {
    return json({ error: "Lesson not found" }, 404);
  }

  const parsed = updateLessonSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const setClauses: string[] = [];
  const values: string[] = [];
  for (const field of ["date", "time", "status", "topic", "essay"] as const) {
    const value = parsed.data[field];
    if (value !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    await db
      .prepare(`UPDATE lessons SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values, id)
      .run();
  }

  return json({ data: await getLesson(db, id) });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  if (!(await getLesson(db, id))) {
    return json({ error: "Lesson not found" }, 404);
  }

  await db.prepare("DELETE FROM lessons WHERE id = ?").bind(id).run();
  return json({ data: { id } });
};
