import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { studentGroupSchema } from "../../../../lib/validation";
import { JOURNAL_ROLES, json, validationError, getGroup } from "../../../../lib/journal";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  if (!(await getGroup(db, id))) {
    return json({ error: "Group not found" }, 404);
  }

  const parsed = studentGroupSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  await db
    .prepare(
      `UPDATE student_groups SET label = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`
    )
    .bind(parsed.data.label, id)
    .run();

  return json({ data: await getGroup(db, id) });
};

export const DELETE: APIRoute = async ({ params, url, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  const group = await getGroup(db, id);
  if (!group) return json({ error: "Group not found" }, 404);

  // Non-empty groups need explicit confirmation (?force=true)
  if (group.studentCount > 0 && url.searchParams.get("force") !== "true") {
    return json(
      { error: "Group has students", studentCount: group.studentCount },
      409
    );
  }

  await db.batch([
    db.prepare("UPDATE student_profiles SET group_id = NULL WHERE group_id = ?").bind(id),
    db.prepare("DELETE FROM student_groups WHERE id = ?").bind(id),
  ]);

  return json({ data: { id } });
};
