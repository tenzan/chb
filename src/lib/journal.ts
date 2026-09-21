// Shared helpers for the student journal API (/api/journal/*).
// Journal students are users with the Student role; journal-specific
// fields live in student_profiles.

export const JOURNAL_ROLES = ["Admin", "Personnel", "Tutor"];

export type Program = "standard" | "intensive";
export type LessonStatus = "present" | "absent" | "excused" | "none";

export interface JournalLesson {
  id: string;
  studentId: string;
  date: string;
  time: string;
  status: LessonStatus;
  topic: string;
  essay: string;
}

export interface JournalStudent {
  id: string;
  name: string;
  schoolClass: string;
  birthDate: string;
  phone: string;
  parentPhone: string;
  program: Program;
  groupId: string | null;
  lessons: JournalLesson[];
}

interface StudentRow {
  id: string;
  name: string;
  birthday: string | null;
  phone: string | null;
  school_class: string | null;
  parent_phone: string | null;
  program: Program;
  group_id: string | null;
}

interface LessonRow {
  id: string;
  student_id: string;
  date: string;
  time: string;
  status: LessonStatus;
  topic: string;
  essay: string;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function validationError(details: unknown): Response {
  return json({ error: "Validation failed", details }, 400);
}

const STUDENT_SELECT = `
  SELECT u.id, u.name, u.birthday, u.phone,
         p.school_class, p.parent_phone,
         COALESCE(p.program, 'standard') AS program, p.group_id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id AND r.name = 'Student'
  LEFT JOIN student_profiles p ON p.user_id = u.id`;

const LESSON_SELECT = `SELECT id, student_id, date, time, status, topic, essay FROM lessons`;
const LESSON_ORDER = `ORDER BY date DESC, time DESC, created_at DESC`;

export function toLesson(row: LessonRow): JournalLesson {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date,
    time: row.time,
    status: row.status,
    topic: row.topic,
    essay: row.essay,
  };
}

function toStudent(row: StudentRow, lessons: JournalLesson[]): JournalStudent {
  return {
    id: row.id,
    name: row.name,
    schoolClass: row.school_class ?? "",
    birthDate: row.birthday ?? "",
    phone: row.phone ?? "",
    parentPhone: row.parent_phone ?? "",
    program: row.program,
    groupId: row.group_id,
    lessons,
  };
}

export async function listStudents(db: D1Database): Promise<JournalStudent[]> {
  const [students, lessons] = await db.batch([
    db.prepare(`${STUDENT_SELECT} ORDER BY u.name ASC`),
    db.prepare(
      `${LESSON_SELECT} WHERE student_id IN (
         SELECT ur.user_id FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.name = 'Student')
       ${LESSON_ORDER}`
    ),
  ]);

  const byStudent = new Map<string, JournalLesson[]>();
  for (const row of lessons.results as LessonRow[]) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(toLesson(row));
    byStudent.set(row.student_id, list);
  }

  return (students.results as StudentRow[]).map((s) =>
    toStudent(s, byStudent.get(s.id) ?? [])
  );
}

export async function getStudent(
  db: D1Database,
  id: string
): Promise<JournalStudent | null> {
  const row = await db
    .prepare(`${STUDENT_SELECT} WHERE u.id = ?`)
    .bind(id)
    .first<StudentRow>();
  if (!row) return null;
  return toStudent(row, await listLessons(db, id));
}

export async function listLessons(
  db: D1Database,
  studentId: string
): Promise<JournalLesson[]> {
  const result = await db
    .prepare(`${LESSON_SELECT} WHERE student_id = ? ${LESSON_ORDER}`)
    .bind(studentId)
    .all<LessonRow>();
  return result.results.map(toLesson);
}

export async function getLesson(
  db: D1Database,
  id: string
): Promise<JournalLesson | null> {
  const row = await db
    .prepare(`${LESSON_SELECT} WHERE id = ?`)
    .bind(id)
    .first<LessonRow>();
  return row ? toLesson(row) : null;
}

export async function groupExists(db: D1Database, id: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM student_groups WHERE id = ?")
    .bind(id)
    .first();
  return row !== null;
}

export interface StudentGroup {
  id: string;
  label: string;
  scheduleSlot: number | null;
  studentCount: number;
}

interface GroupRow {
  id: string;
  label: string;
  schedule_slot: number | null;
  student_count: number;
}

const GROUP_SELECT = `
  SELECT g.id, g.label, g.schedule_slot,
         (SELECT count(*) FROM student_profiles p WHERE p.group_id = g.id) AS student_count
  FROM student_groups g`;

function toGroup(row: GroupRow): StudentGroup {
  return {
    id: row.id,
    label: row.label,
    scheduleSlot: row.schedule_slot,
    studentCount: row.student_count,
  };
}

export async function listGroups(db: D1Database): Promise<StudentGroup[]> {
  const result = await db
    .prepare(`${GROUP_SELECT} ORDER BY g.position ASC, g.created_at ASC`)
    .all<GroupRow>();
  return result.results.map(toGroup);
}

export async function getGroup(db: D1Database, id: string): Promise<StudentGroup | null> {
  const row = await db
    .prepare(`${GROUP_SELECT} WHERE g.id = ?`)
    .bind(id)
    .first<GroupRow>();
  return row ? toGroup(row) : null;
}

export interface TopicCategory {
  id: string;
  name: string;
  topics: { id: string; text: string }[];
}

export async function listTopicCategories(db: D1Database): Promise<TopicCategory[]> {
  const [categories, topics] = await db.batch([
    db.prepare("SELECT id, name FROM topic_categories ORDER BY position ASC, created_at ASC"),
    db.prepare(
      "SELECT id, category_id, text FROM topics ORDER BY position ASC, created_at ASC"
    ),
  ]);

  const byCategory = new Map<string, { id: string; text: string }[]>();
  for (const t of topics.results as { id: string; category_id: string; text: string }[]) {
    const list = byCategory.get(t.category_id) ?? [];
    list.push({ id: t.id, text: t.text });
    byCategory.set(t.category_id, list);
  }

  return (categories.results as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
    topics: byCategory.get(c.id) ?? [],
  }));
}
