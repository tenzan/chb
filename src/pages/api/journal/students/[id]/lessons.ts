import type { APIRoute } from "astro";
import { getDB } from "../../../../../lib/db";
import { hasRole } from "../../../../../lib/rbac";
import { generateId } from "../../../../../lib/id";
import { createLessonSchema } from "../../../../../lib/validation";
import {
  JOURNAL_ROLES,
  json,
  validationError,
  getStudent,
  getLesson,
  listLessons,
} from "../../../../../lib/journal";

export const GET: APIRoute = async ({ params, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  if (!(await getStudent(db, params.id!))) {
    return json({ error: "Student not found" }, 404);
  }

  return json({ data: await listLessons(db, params.id!) });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const studentId = params.id!;
  if (!(await getStudent(db, studentId))) {
    return json({ error: "Student not found" }, 404);
  }

  const parsed = createLessonSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { date, time, status, topic, essay } = parsed.data;
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO lessons (id, student_id, date, time, status, topic, essay, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, studentId, date, time, status, topic, essay, locals.user!.id)
    .run();

  return json({ data: await getLesson(db, id) }, 201);
};
