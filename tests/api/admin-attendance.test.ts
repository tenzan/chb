import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser, createTestSubject, createTestEnrollment } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/attendance/index";
import { PATCH } from "../../src/pages/api/admin/attendance/[id]";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

async function setupStudentWithEnrollment() {
  await seedRoles();
  await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
  const student = await createTestUser({ id: "student-1", email: "s1@student.local", name: "Alice", roles: ["Student"] });
  const subject = await createTestSubject({ id: "subj-1", name: "Math" });
  const enrollment = await createTestEnrollment({ id: "enr-1", studentId: student.id, subjectId: subject.id });
  return { student, subject, enrollment };
}

describe("POST /api/admin/attendance", () => {
  it("records attendance", async () => {
    await setupStudentWithEnrollment();

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "present" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; enrollment_id: string; date: string; status: string } };
    expect(body.data.enrollment_id).toBe("enr-1");
    expect(body.data.date).toBe("2026-04-01");
    expect(body.data.status).toBe("present");
  });

  it("upserts: existing record for same enrollment+date gets updated", async () => {
    await setupStudentWithEnrollment();
    const db = getTestDB();

    // First insert
    const ctx1 = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "present" },
    });
    const res1 = await POST(ctx1);
    expect(res1.status).toBe(201);

    // Upsert same enrollment+date with different status
    const ctx2 = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "absent" },
    });
    const res2 = await POST(ctx2);
    expect(res2.status).toBe(200);

    const body = (await res2.json()) as { data: { status: string } };
    expect(body.data.status).toBe("absent");

    // Verify only 1 row in DB
    const rows = await db
      .prepare("SELECT * FROM attendance WHERE enrollment_id = ? AND date = ?")
      .bind("enr-1", "2026-04-01")
      .all();
    expect(rows.results.length).toBe(1);
  });

  it("records with a note", async () => {
    await setupStudentWithEnrollment();

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "notified_absent", note: "Called in sick" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { note: string } };
    expect(body.data.note).toBe("Called in sick");
  });

  it("returns 404 for non-existent enrollment", async () => {
    await setupStudentWithEnrollment();

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "nonexistent", date: "2026-04-01", status: "present" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(404);
  });

  it("validates date format", async () => {
    await setupStudentWithEnrollment();

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "April 1", status: "present" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(400);
  });

  it("validates status enum", async () => {
    await setupStudentWithEnrollment();

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "late" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(400);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
      body: { enrollment_id: "enr-1", date: "2026-04-01", status: "present" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/attendance", () => {
  it("filters by student_id and month", async () => {
    const { enrollment } = await setupStudentWithEnrollment();
    const db = getTestDB();

    // Insert 3 records: 2 in April, 1 in March
    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-1", "enr-1", "2026-04-01", "present", "admin-1")
      .run();
    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-2", "enr-1", "2026-04-03", "absent", "admin-1")
      .run();
    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-3", "enr-1", "2026-03-15", "present", "admin-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      searchParams: { student_id: "student-1", month: "2026-04" },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<any> };
    expect(body.data.length).toBe(2);
  });

  it("returns subject_name via JOINs", async () => {
    await setupStudentWithEnrollment();
    const db = getTestDB();

    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-1", "enr-1", "2026-04-01", "present", "admin-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ subject_name: string; student_name: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].subject_name).toBe("Math");
    expect(body.data[0].student_name).toBe("Alice");
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
    });
    const res = await GET(ctx);

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/attendance/:id", () => {
  it("updates status", async () => {
    await setupStudentWithEnrollment();
    const db = getTestDB();

    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-1", "enr-1", "2026-04-01", "present", "admin-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: "att-1" },
      body: { status: "absent" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("absent");
  });

  it("updates note", async () => {
    await setupStudentWithEnrollment();
    const db = getTestDB();

    await db
      .prepare("INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES (?, ?, ?, ?, ?)")
      .bind("att-1", "enr-1", "2026-04-01", "present", "admin-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: "att-1" },
      body: { note: "Was feeling unwell" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { note: string } };
    expect(body.data.note).toBe("Was feeling unwell");
  });

  it("returns 404 for non-existent attendance", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "PATCH",
      params: { id: "nonexistent" },
      body: { status: "absent" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(404);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "PATCH",
      params: { id: "att-1" },
      body: { status: "absent" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(403);
  });
});
