import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { generateId } from "../../../../lib/id";
import { createJournalStudentSchema } from "../../../../lib/validation";
import {
  JOURNAL_ROLES,
  json,
  validationError,
  listStudents,
  getStudent,
  groupExists,
} from "../../../../lib/journal";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  return json({ data: await listStudents(db) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const parsed = createJournalStudentSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { name, schoolClass, birthDate, phone, parentPhone, program, groupId } = parsed.data;

  if (groupId && !(await groupExists(db, groupId))) {
    return json({ error: "Group not found" }, 400);
  }

  const id = generateId();

  await db.batch([
    db
      .prepare("INSERT INTO users (id, email, name, birthday, phone) VALUES (?, ?, ?, ?, ?)")
      .bind(id, `${id}@student.local`, name, birthDate || null, phone || null),
    db
      .prepare(
        "INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Student'"
      )
      .bind(id),
    db
      .prepare(
        `INSERT INTO student_profiles (user_id, school_class, parent_phone, program, group_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, schoolClass || null, parentPhone || null, program, groupId),
  ]);

  return json({ data: await getStudent(db, id) }, 201);
};
