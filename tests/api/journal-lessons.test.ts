import { describe, it, expect, beforeEach } from "vitest";
import { getTestDB } from "../setup/test-env";
import {
  seedRoles,
  createTestUser,
  createTestJournalStudent,
  createTestLesson,
} from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/journal/students/[id]/lessons";
import { PATCH, DELETE } from "../../src/pages/api/journal/lessons/[id]";

const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };
const accountantUser = { id: "acc-1", email: "acc@test.com", name: "Acc", roles: ["Accountant"] };

let studentId: string;

beforeEach(async () => {
  await seedRoles();
  await createTestUser({ id: "tutor-1", email: "tutor@test.com", roles: ["Tutor"] });
  studentId = (await createTestJournalStudent()).id;
});

describe("GET /api/journal/students/:id/lessons", () => {
  it("lists lessons newest first", async () => {
    await createTestLesson({ studentId, date: "2026-09-01" });
    await createTestLesson({ studentId, date: "2026-09-05" });

    const res = await GET(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, params: { id: studentId } })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any[] };
    expect(body.data.map((l) => l.date)).toEqual(["2026-09-05", "2026-09-01"]);
  });

  it("returns 404 for unknown student", async () => {
    const res = await GET(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, params: { id: "nope" } })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 without journal role", async () => {
    const res = await GET(
      createMockAPIContext({ db: getTestDB(), user: accountantUser, params: { id: studentId } })
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/journal/students/:id/lessons", () => {
  it("creates a lesson with defaults", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        params: { id: studentId },
        body: { date: "2026-09-21" },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({
      studentId,
      date: "2026-09-21",
      time: "",
      status: "none",
      topic: "",
      essay: "",
    });
    expect(body.data.id).toBeDefined();
  });

  it("creates a lesson from the overview grid with a status", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        params: { id: studentId },
        body: { date: "2026-09-21", status: "present" },
      })
    );
    const body = (await res.json()) as { data: any };
    expect(body.data.status).toBe("present");
  });

  it("rejects an invalid status", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        params: { id: studentId },
        body: { date: "2026-09-21", status: "late" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed date or time", async () => {
    for (const body of [{ date: "21.09.2026" }, { date: "2026-09-21", time: "25:00" }]) {
      const res = await POST(
        createMockAPIContext({
          db: getTestDB(),
          user: tutorUser,
          method: "POST",
          params: { id: studentId },
          body,
        })
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 404 for unknown student", async () => {
    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        params: { id: "nope" },
        body: { date: "2026-09-21" },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/journal/lessons/:id", () => {
  it("updates any subset of fields", async () => {
    const lesson = await createTestLesson({ studentId, topic: "Old" });

    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: lesson.id },
        body: { status: "excused", essay: "Понял дроби", time: "11:10" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({
      status: "excused",
      essay: "Понял дроби",
      time: "11:10",
      topic: "Old",
    });
  });

  it("allows clearing time with an empty string", async () => {
    const lesson = await createTestLesson({ studentId, time: "10:00" });
    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: lesson.id },
        body: { time: "" },
      })
    );
    const body = (await res.json()) as { data: any };
    expect(body.data.time).toBe("");
  });

  it("returns 404 for unknown lesson", async () => {
    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: "nope" },
        body: { status: "present" },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/journal/lessons/:id", () => {
  it("deletes the lesson", async () => {
    const lesson = await createTestLesson({ studentId });
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: lesson.id } })
    );
    expect(res.status).toBe(200);
    const row = await getTestDB().prepare("SELECT id FROM lessons WHERE id = ?").bind(lesson.id).first();
    expect(row).toBeNull();
  });

  it("returns 404 for unknown lesson", async () => {
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: "nope" } })
    );
    expect(res.status).toBe(404);
  });
});
