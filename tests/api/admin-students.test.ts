import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/students/index";
import { PATCH } from "../../src/pages/api/admin/students/[id]";
import { POST as linkParentHandler } from "../../src/pages/api/admin/students/[id]/link-parent";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

async function createParent(email: string = "parent@test.com") {
  return createTestUser({
    id: crypto.randomUUID(),
    email,
    name: "Parent User",
    roles: ["Parent"],
  });
}

describe("POST /api/admin/students", () => {
  it("creates student linked to parent", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent = await createParent();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Student Name", parentUserId: parent.id },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { name: string; parentUserId: string } };
    expect(body.data.name).toBe("Student Name");
    expect(body.data.parentUserId).toBe(parent.id);

    const link = await db
      .prepare("SELECT * FROM parent_students WHERE parent_user_id = ?")
      .bind(parent.id)
      .first();
    expect(link).not.toBeNull();
  });

  it("validates parentUserId exists and has Parent role", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const tutor = await createTestUser({ id: "tutor-2", email: "tutor2@test.com", name: "Tutor 2", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Student", parentUserId: tutor.id },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(400);
  });

  it("birthday is optional", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent = await createParent();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Student No Birthday", parentUserId: parent.id, description: "Some desc" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
      body: { name: "Student", parentUserId: "some-id" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/students", () => {
  it("lists all students with parent info", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent = await createParent();

    const studentId = crypto.randomUUID();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(studentId, "Test Student").run();
    await db.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent.id, studentId).run();

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ name: string; parents: Array<{ id: string; name: string }> }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Test Student");
    expect(body.data[0].parents.length).toBe(1);
    expect(body.data[0].parents[0].name).toBe("Parent User");
  });

  it("filters by parentUserId", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent1 = await createParent("parent1@test.com");
    const parent2 = await createParent("parent2@test.com");

    const s1 = crypto.randomUUID();
    const s2 = crypto.randomUUID();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(s1, "Student 1").run();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(s2, "Student 2").run();
    await db.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent1.id, s1).run();
    await db.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent2.id, s2).run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      searchParams: { parentUserId: parent1.id },
    });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ name: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Student 1");
  });
});

describe("PATCH /api/admin/students/:id", () => {
  it("updates student fields", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const studentId = crypto.randomUUID();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(studentId, "Original Name").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: studentId },
      body: { name: "Updated Name", note: "Some note" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { name: string; note: string } };
    expect(body.data.name).toBe("Updated Name");
    expect(body.data.note).toBe("Some note");
  });

  it("404 for non-existent student", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "PATCH",
      params: { id: "nonexistent-id" },
      body: { name: "Updated" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/students/:id/link-parent", () => {
  it("creates parent-student link", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent = await createParent();

    const studentId = crypto.randomUUID();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(studentId, "Student").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: studentId },
      body: { parentUserId: parent.id },
    });
    const res = await linkParentHandler(ctx);

    expect(res.status).toBe(200);
  });

  it("rejects if link already exists", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const parent = await createParent();

    const studentId = crypto.randomUUID();
    await db.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(studentId, "Student").run();
    await db.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent.id, studentId).run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: studentId },
      body: { parentUserId: parent.id },
    });
    const res = await linkParentHandler(ctx);

    expect(res.status).toBe(409);
  });
});
