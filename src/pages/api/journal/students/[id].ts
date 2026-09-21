import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { updateJournalStudentSchema } from "../../../../lib/validation";
import {
  JOURNAL_ROLES,
  json,
  validationError,
  getStudent,
  groupExists,
} from "../../../../lib/journal";

export const GET: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const student = await getStudent(getDB(locals), params.id!);
  if (!student) return json({ error: "Student not found" }, 404);

  return json({ data: student });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  const current = await getStudent(db, id);
  if (!current) return json({ error: "Student not found" }, 404);

  const parsed = updateJournalStudentSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const next = { ...current, ...parsed.data };

  if (parsed.data.groupId && !(await groupExists(db, parsed.data.groupId))) {
    return json({ error: "Group not found" }, 400);
  }

  await db.batch([
    db
      .prepare(
        `UPDATE users SET name = ?, birthday = ?, phone = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      )
      .bind(next.name, next.birthDate || null, next.phone || null, id),
    // Students created elsewhere (Users page) may not have a profile yet
    db
      .prepare(
        `INSERT INTO student_profiles (user_id, school_class, parent_phone, program, group_id)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(user_id) DO UPDATE SET
           school_class = ?2, parent_phone = ?3, program = ?4, group_id = ?5,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
      )
      .bind(id, next.schoolClass || null, next.parentPhone || null, next.program, next.groupId),
  ]);

  return json({ data: await getStudent(db, id) });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const id = params.id!;
  if (!(await getStudent(db, id))) {
    return json({ error: "Student not found" }, 404);
  }

  // Remove everything owned by the student in one transaction
  await db.batch([
    db.prepare("DELETE FROM lessons WHERE student_id = ?").bind(id),
    db
      .prepare(
        "DELETE FROM attendance WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)"
      )
      .bind(id),
    db.prepare("DELETE FROM enrollments WHERE student_id = ?").bind(id),
    db.prepare("DELETE FROM student_profiles WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM parent_students WHERE student_id = ?").bind(id),
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);

  return json({ data: { id } });
};
