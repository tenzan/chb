import { getTestDB } from './test-env';

export async function seedRoles() {
  const db = getTestDB();
  const roles = ['Admin', 'Personnel', 'Tutor', 'Accountant', 'Parent', 'Student'];
  for (const role of roles) {
    await db
      .prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)')
      .bind(role)
      .run();
  }
}

export async function createTestUser(
  options: {
    id?: string;
    email?: string;
    name?: string;
    passwordHash?: string;
    salt?: string;
    roles?: string[];
  } = {}
) {
  const db = getTestDB();
  const {
    id = crypto.randomUUID(),
    email = 'test@example.com',
    name = 'Test User',
    passwordHash = 'fakehash',
    salt = 'fakesalt',
    roles = [],
  } = options;

  await db
    .prepare(
      'INSERT INTO users (id, email, password_hash, salt, name) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, email, passwordHash, salt, name)
    .run();

  for (const roleName of roles) {
    const role = await db
      .prepare('SELECT id FROM roles WHERE name = ?')
      .bind(roleName)
      .first<{ id: number }>();
    if (role) {
      await db
        .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
        .bind(id, role.id)
        .run();
    }
  }

  return { id, email, name };
}

export async function createTestSubject(
  options: {
    id?: string;
    name?: string;
    description?: string;
  } = {}
) {
  const db = getTestDB();
  const {
    id = crypto.randomUUID(),
    name = 'Test Subject',
    description,
  } = options;

  await db
    .prepare('INSERT INTO subjects (id, name, description) VALUES (?, ?, ?)')
    .bind(id, name, description || null)
    .run();

  return { id, name };
}

export async function createTestEnrollment(
  options: {
    id?: string;
    studentId: string;
    subjectId: string;
  }
) {
  const db = getTestDB();
  const { id = crypto.randomUUID(), studentId, subjectId } = options;

  await db
    .prepare('INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)')
    .bind(id, studentId, subjectId)
    .run();

  return { id, studentId, subjectId };
}

export async function createTestStudentGroup(
  options: { id?: string; label?: string; scheduleSlot?: number | null; position?: number } = {}
) {
  const db = getTestDB();
  const { id = crypto.randomUUID(), label = 'Test Group', scheduleSlot = null, position = 0 } = options;

  await db
    .prepare('INSERT INTO student_groups (id, label, schedule_slot, position) VALUES (?, ?, ?, ?)')
    .bind(id, label, scheduleSlot, position)
    .run();

  return { id, label };
}

export async function createTestJournalStudent(
  options: {
    id?: string;
    name?: string;
    groupId?: string | null;
    program?: 'standard' | 'intensive';
    schoolClass?: string;
  } = {}
) {
  const db = getTestDB();
  const {
    id = crypto.randomUUID(),
    name = 'Test Student',
    groupId = null,
    program = 'standard',
    schoolClass = null,
  } = options;

  await db.batch([
    db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').bind(id, `${id}@student.local`, name),
    db
      .prepare("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Student'")
      .bind(id),
    db
      .prepare('INSERT INTO student_profiles (user_id, school_class, program, group_id) VALUES (?, ?, ?, ?)')
      .bind(id, schoolClass, program, groupId),
  ]);

  return { id, name };
}

export async function createTestLesson(
  options: {
    id?: string;
    studentId: string;
    date?: string;
    time?: string;
    status?: 'present' | 'absent' | 'excused' | 'none';
    topic?: string;
    essay?: string;
  }
) {
  const db = getTestDB();
  const {
    id = crypto.randomUUID(),
    studentId,
    date = '2026-09-01',
    time = '10:00',
    status = 'none',
    topic = '',
    essay = '',
  } = options;

  await db
    .prepare('INSERT INTO lessons (id, student_id, date, time, status, topic, essay) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, studentId, date, time, status, topic, essay)
    .run();

  return { id, studentId, date };
}

export async function createTestTopicCategory(
  options: { id?: string; name?: string; position?: number } = {}
) {
  const db = getTestDB();
  const { id = crypto.randomUUID(), name = 'Test Category', position = 0 } = options;

  await db
    .prepare('INSERT INTO topic_categories (id, name, position) VALUES (?, ?, ?)')
    .bind(id, name, position)
    .run();

  return { id, name };
}
