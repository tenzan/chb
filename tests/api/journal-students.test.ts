import { describe, it, expect, beforeEach } from "vitest";
import { getTestDB } from "../setup/test-env";
import {
  seedRoles,
  createTestUser,
  createTestStudentGroup,
  createTestJournalStudent,
  createTestLesson,
  createTestSubject,
  createTestEnrollment,
} from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/journal/students/index";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "../../src/pages/api/journal/students/[id]";

const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };
const parentUser = { id: "parent-1", email: "parent@test.com", name: "Parent", roles: ["Parent"] };

beforeEach(async () => {
  await seedRoles();
  await createTestUser({ id: "tutor-1", email: "tutor@test.com", roles: ["Tutor"] });
});

describe("GET /api/journal/students", () => {
  it("returns 403 for roles without journal access", async () => {
    const res = await GET(createMockAPIContext({ db: getTestDB(), user: parentUser }));
    expect(res.status).toBe(403);
  });

  it("lists students with profile fields and nested lessons", async () => {
    const group = await createTestStudentGroup({ label: "1-я группа" });
    const s = await createTestJournalStudent({
      name: "Аружан",
      groupId: group.id,
      program: "intensive",
      schoolClass: "9 класс",
    });
    await createTestLesson({ studentId: s.id, date: "2026-09-01", status: "present", topic: "Дроби" });
    await createTestLesson({ studentId: s.id, date: "2026-09-03", status: "absent" });

    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any[] };

    expect(body.data).toHaveLength(1);
    const student = body.data[0];
    expect(student).toMatchObject({
      id: s.id,
      name: "Аружан",
      schoolClass: "9 класс",
      program: "intensive",
      groupId: group.id,
      parentPhone: "",
    });
    expect(student.lessons.map((l: any) => l.date)).toEqual(["2026-09-03", "2026-09-01"]);
    expect(student.lessons[1]).toMatchObject({ status: "present", topic: "Дроби", studentId: s.id });
  });

  it("includes Student users that have no journal profile yet", async () => {
    await createTestUser({ id: "stu-1", email: "stu@student.local", name: "Legacy", roles: ["Student"] });

    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    const body = (await res.json()) as { data: any[] };

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ name: "Legacy", program: "standard", groupId: null, lessons: [] });
  });

  it("does not list non-student users", async () => {
    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    const body = (await res.json()) as { data: any[] };
    expect(body.data).toEqual([]);
  });
});

describe("POST /api/journal/students", () => {
  it("creates a Student user with a profile", async () => {
    const group = await createTestStudentGroup();
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        body: {
          name: "  Данияр  ",
          schoolClass: "11 класс",
          birthDate: "2009-11-02",
          phone: "+996 555 44 33 22",
          parentPhone: "",
          program: "intensive",
          groupId: group.id,
        },
      })
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({
      name: "Данияр",
      schoolClass: "11 класс",
      birthDate: "2009-11-02",
      phone: "+996 555 44 33 22",
      program: "intensive",
      groupId: group.id,
      lessons: [],
    });

    const role = await getTestDB()
      .prepare(
        `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`
      )
      .bind(body.data.id)
      .first<{ name: string }>();
    expect(role?.name).toBe("Student");
  });

  it("applies defaults for optional fields", async () => {
    const res = await POST(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "POST", body: { name: "Тимур" } })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({ program: "standard", groupId: null, birthDate: "", phone: "" });
  });

  it("rejects a missing name", async () => {
    const res = await POST(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "POST", body: { name: "  " } })
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown program", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        body: { name: "X", program: "turbo" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a group that does not exist", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        body: { name: "X", groupId: "missing" },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/journal/students/:id", () => {
  it("returns the student with lessons", async () => {
    const s = await createTestJournalStudent({ name: "Алина" });
    await createTestLesson({ studentId: s.id });

    const res = await GET_ONE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, params: { id: s.id } })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };
    expect(body.data.name).toBe("Алина");
    expect(body.data.lessons).toHaveLength(1);
  });

  it("returns 404 for a non-student user", async () => {
    const res = await GET_ONE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, params: { id: "tutor-1" } })
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/journal/students/:id", () => {
  it("updates user and profile fields", async () => {
    const g2 = await createTestStudentGroup({ label: "2" });
    const s = await createTestJournalStudent({ name: "Old", program: "standard" });

    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: s.id },
        body: { name: "New", parentPhone: "+996 700", program: "intensive", groupId: g2.id },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({
      name: "New",
      parentPhone: "+996 700",
      program: "intensive",
      groupId: g2.id,
    });
  });

  it("creates a profile for a Student user that had none", async () => {
    await createTestUser({ id: "stu-1", email: "stu@student.local", name: "Legacy", roles: ["Student"] });

    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: "stu-1" },
        body: { schoolClass: "7 класс" },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({ name: "Legacy", schoolClass: "7 класс", program: "standard" });
  });

  it("can unassign the group with null", async () => {
    const g = await createTestStudentGroup();
    const s = await createTestJournalStudent({ groupId: g.id });

    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: s.id },
        body: { groupId: null },
      })
    );
    const body = (await res.json()) as { data: any };
    expect(body.data.groupId).toBeNull();
  });

  it("returns 404 for unknown student", async () => {
    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: "nope" },
        body: { name: "X" },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/journal/students/:id", () => {
  it("deletes the student together with lessons and profile", async () => {
    const s = await createTestJournalStudent();
    await createTestLesson({ studentId: s.id });

    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: s.id } })
    );
    expect(res.status).toBe(200);

    const db = getTestDB();
    const counts = await db
      .prepare(
        `SELECT (SELECT count(*) FROM users WHERE id = ?1) AS users,
                (SELECT count(*) FROM lessons WHERE student_id = ?1) AS lessons,
                (SELECT count(*) FROM student_profiles WHERE user_id = ?1) AS profiles`
      )
      .bind(s.id)
      .first<{ users: number; lessons: number; profiles: number }>();
    expect(counts).toEqual({ users: 0, lessons: 0, profiles: 0 });
  });

  it("also removes the student's enrollments and subject attendance", async () => {
    const s = await createTestJournalStudent();
    const subject = await createTestSubject();
    const enrollment = await createTestEnrollment({ studentId: s.id, subjectId: subject.id });
    const db = getTestDB();
    await db
      .prepare(
        "INSERT INTO attendance (id, enrollment_id, date, status, recorded_by) VALUES ('a1', ?, '2026-09-01', 'present', 'tutor-1')"
      )
      .bind(enrollment.id)
      .run();

    const res = await DELETE(
      createMockAPIContext({ db, user: tutorUser, method: "DELETE", params: { id: s.id } })
    );
    expect(res.status).toBe(200);
    const left = await db.prepare("SELECT count(*) AS n FROM enrollments").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("refuses to delete a user who is not a student", async () => {
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: "tutor-1" } })
    );
    expect(res.status).toBe(404);
  });
});
