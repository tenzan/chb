import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/api";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createStudentSchema, updateStudentSchema } from "../lib/validation";
import { generateId } from "../lib/id";

type Variables = {
  user: AuthUser;
  sessionToken: string;
};

const adminStudents = new Hono<{ Bindings: Env; Variables: Variables }>();

adminStudents.use("*", authMiddleware);

adminStudents.post("/", requireRole("Admin"), async (c) => {
  const body = await c.req.json();
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { name, parentUserId, birthday, description, note } = parsed.data;

  // Verify parent exists and has Parent role
  const parent = await c.env.DB.prepare(
    `SELECT u.id FROM users u
     JOIN user_roles ur ON u.id = ur.user_id
     JOIN roles r ON ur.role_id = r.id
     WHERE u.id = ? AND r.name = 'Parent'`
  )
    .bind(parentUserId)
    .first();

  if (!parent) {
    return c.json({ error: "Parent user not found or does not have Parent role" }, 400);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO students (id, name, birthday, description, note) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, name, birthday || null, description || null, note || null)
    .run();

  // Link parent to student
  await c.env.DB.prepare(
    `INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)`
  )
    .bind(parentUserId, id)
    .run();

  return c.json({
    data: { id, name, birthday: birthday || null, description: description || null, note: note || null, parentUserId },
  }, 201);
});

adminStudents.get("/", requireRole("Admin"), async (c) => {
  const parentUserId = c.req.query("parentUserId");

  let query: string;
  let params: string[];

  if (parentUserId) {
    query = `SELECT s.id, s.name, s.birthday, s.description, s.note, s.created_at, s.updated_at
             FROM students s
             JOIN parent_students ps ON s.id = ps.student_id
             WHERE ps.parent_user_id = ?
             ORDER BY s.created_at DESC`;
    params = [parentUserId];
  } else {
    query = `SELECT s.id, s.name, s.birthday, s.description, s.note, s.created_at, s.updated_at
             FROM students s
             ORDER BY s.created_at DESC`;
    params = [];
  }

  const stmt = c.env.DB.prepare(query);
  const result = parentUserId
    ? await stmt.bind(parentUserId).all<{
        id: string;
        name: string;
        birthday: string | null;
        description: string | null;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>()
    : await stmt.all<{
        id: string;
        name: string;
        birthday: string | null;
        description: string | null;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>();

  // Fetch parents for each student
  const students = await Promise.all(
    result.results.map(async (s) => {
      const parentsResult = await c.env.DB.prepare(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN parent_students ps ON u.id = ps.parent_user_id
         WHERE ps.student_id = ?`
      )
        .bind(s.id)
        .all<{ id: string; name: string; email: string }>();

      return {
        ...s,
        parents: parentsResult.results,
      };
    })
  );

  return c.json({ data: students });
});

adminStudents.patch("/:id", requireRole("Admin"), async (c) => {
  const studentId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  // Check student exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM students WHERE id = ?"
  )
    .bind(studentId)
    .first();
  if (!existing) {
    return c.json({ error: "Student not found" }, 404);
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    values.push(updates.name);
  }
  if (updates.birthday !== undefined) {
    setClauses.push("birthday = ?");
    values.push(updates.birthday);
  }
  if (updates.description !== undefined) {
    setClauses.push("description = ?");
    values.push(updates.description);
  }
  if (updates.note !== undefined) {
    setClauses.push("note = ?");
    values.push(updates.note);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    await c.env.DB.prepare(
      `UPDATE students SET ${setClauses.join(", ")} WHERE id = ?`
    )
      .bind(...values, studentId)
      .run();
  }

  // Return updated student
  const student = await c.env.DB.prepare(
    "SELECT id, name, birthday, description, note, created_at, updated_at FROM students WHERE id = ?"
  )
    .bind(studentId)
    .first<{
      id: string;
      name: string;
      birthday: string | null;
      description: string | null;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return c.json({ data: student });
});

adminStudents.post("/:id/link-parent", requireRole("Admin"), async (c) => {
  const studentId = c.req.param("id");
  const body = await c.req.json();
  const parentUserId = body.parentUserId;

  if (!parentUserId) {
    return c.json({ error: "parentUserId is required" }, 400);
  }

  // Check if link already exists
  const existing = await c.env.DB.prepare(
    "SELECT parent_user_id FROM parent_students WHERE parent_user_id = ? AND student_id = ?"
  )
    .bind(parentUserId, studentId)
    .first();

  if (existing) {
    return c.json({ error: "Link already exists" }, 409);
  }

  await c.env.DB.prepare(
    "INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)"
  )
    .bind(parentUserId, studentId)
    .run();

  return c.json({ data: { message: "Parent linked to student" } });
});

export default adminStudents;
