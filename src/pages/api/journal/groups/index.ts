import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { generateId } from "../../../../lib/id";
import { studentGroupSchema } from "../../../../lib/validation";
import { JOURNAL_ROLES, json, validationError, listGroups, getGroup } from "../../../../lib/journal";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  return json({ data: await listGroups(getDB(locals)) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const parsed = studentGroupSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO student_groups (id, label, position)
       VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM student_groups))`
    )
    .bind(id, parsed.data.label)
    .run();

  return json({ data: await getGroup(db, id) }, 201);
};
