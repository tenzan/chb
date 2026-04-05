import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser, createTestSubject } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/enrollments/index";
import { DELETE } from "../../src/pages/api/admin/enrollments/[id]";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

describe("POST /api/admin/enrollments", () => {
  it("enrolls a student in a subject", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const student = await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });
    const subject = await createTestSubject({ id: "subj-1", name: "Physics" });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { student_id: student.id, subject_id: subject.id },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; student_id: string; subject_id: string } };
    expect(body.data.id).toBeDefined();
    expect(body.data.student_id).toBe("student-1");
    expect(body.data.subject_id).toBe("subj-1");
  });

  it("rejects duplicate enrollment", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-1", "student-1", "subj-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { student_id: "student-1", subject_id: "subj-1" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent student", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { student_id: "nonexistent", subject_id: "subj-1" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent subject", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { student_id: "student-1", subject_id: "nonexistent" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(404);
  });

  it("validates required fields", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: {},
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
      body: { student_id: "student-1", subject_id: "subj-1" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/enrollments", () => {
  it("lists all enrollments with student_name and subject_name", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-1", "student-1", "subj-1")
      .run();

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; student_name: string; subject_name: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].student_name).toBe("Alice");
    expect(body.data[0].subject_name).toBe("Physics");
  });

  it("filters by student_id", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "s1@test.com", name: "Alice", roles: ["Student"] });
    await createTestUser({ id: "student-2", email: "s2@test.com", name: "Bob", roles: ["Student"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-1", "student-1", "subj-1")
      .run();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-2", "student-2", "subj-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      searchParams: { student_id: "student-1" },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ student_id: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].student_id).toBe("student-1");
  });

  it("filters by subject_id", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });
    await createTestSubject({ id: "subj-2", name: "Chemistry" });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-1", "student-1", "subj-1")
      .run();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-2", "student-1", "subj-2")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      searchParams: { subject_id: "subj-2" },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ subject_id: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].subject_id).toBe("subj-2");
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: tutorUser });
    const res = await GET(ctx);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/enrollments/:id", () => {
  it("soft-deletes by setting ended_at", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Alice", roles: ["Student"] });
    await createTestSubject({ id: "subj-1", name: "Physics" });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO enrollments (id, student_id, subject_id) VALUES (?, ?, ?)")
      .bind("enr-1", "student-1", "subj-1")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "DELETE",
      params: { id: "enr-1" },
    });
    const res = await DELETE(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("enr-1");

    const row = await db
      .prepare("SELECT ended_at FROM enrollments WHERE id = ?")
      .bind("enr-1")
      .first<{ ended_at: string | null }>();
    expect(row).not.toBeNull();
    expect(row!.ended_at).not.toBeNull();
  });

  it("returns 404 for non-existent enrollment", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "DELETE",
      params: { id: "nonexistent" },
    });
    const res = await DELETE(ctx);

    expect(res.status).toBe(404);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "DELETE",
      params: { id: "enr-1" },
    });
    const res = await DELETE(ctx);

    expect(res.status).toBe(403);
  });
});
