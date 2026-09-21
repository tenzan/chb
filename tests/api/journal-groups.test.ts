import { describe, it, expect, beforeEach } from "vitest";
import { getTestDB } from "../setup/test-env";
import {
  seedRoles,
  createTestUser,
  createTestStudentGroup,
  createTestJournalStudent,
} from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/journal/groups/index";
import { PATCH, DELETE } from "../../src/pages/api/journal/groups/[id]";

const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };
const parentUser = { id: "parent-1", email: "parent@test.com", name: "Parent", roles: ["Parent"] };

beforeEach(async () => {
  await seedRoles();
  await createTestUser({ id: "tutor-1", email: "tutor@test.com", roles: ["Tutor"] });
});

describe("GET /api/journal/groups", () => {
  it("lists groups in order with schedule slot and student count", async () => {
    const g2 = await createTestStudentGroup({ label: "2-я группа", scheduleSlot: 2, position: 2 });
    const g1 = await createTestStudentGroup({ label: "1-я группа", scheduleSlot: 1, position: 1 });
    await createTestJournalStudent({ groupId: g1.id });
    await createTestJournalStudent({ groupId: g1.id });

    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any[] };
    expect(body.data).toEqual([
      { id: g1.id, label: "1-я группа", scheduleSlot: 1, studentCount: 2 },
      { id: g2.id, label: "2-я группа", scheduleSlot: 2, studentCount: 0 },
    ]);
  });

  it("returns 403 without journal role", async () => {
    const res = await GET(createMockAPIContext({ db: getTestDB(), user: parentUser }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/journal/groups", () => {
  it("creates a group appended at the end without a schedule slot", async () => {
    await createTestStudentGroup({ label: "1", position: 5 });

    const res = await POST(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "POST",
        body: { label: " Вечерняя " },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({ label: "Вечерняя", scheduleSlot: null, studentCount: 0 });

    const list = (await (
      await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }))
    ).json()) as { data: any[] };
    expect(list.data.at(-1).label).toBe("Вечерняя");
  });

  it("rejects an empty label", async () => {
    const res = await POST(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "POST", body: { label: "" } })
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/journal/groups/:id", () => {
  it("renames the group", async () => {
    const g = await createTestStudentGroup({ label: "Old" });
    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: g.id },
        body: { label: "New" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };
    expect(body.data.label).toBe("New");
  });

  it("returns 404 for unknown group", async () => {
    const res = await PATCH(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "PATCH",
        params: { id: "nope" },
        body: { label: "X" },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/journal/groups/:id", () => {
  it("deletes an empty group", async () => {
    const g = await createTestStudentGroup();
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: g.id } })
    );
    expect(res.status).toBe(200);
  });

  it("refuses to delete a group with students and reports the count", async () => {
    const g = await createTestStudentGroup();
    await createTestJournalStudent({ groupId: g.id });

    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: g.id } })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; studentCount: number };
    expect(body.studentCount).toBe(1);
  });

  it("with force=true deletes the group and unassigns its students", async () => {
    const g = await createTestStudentGroup();
    const s = await createTestJournalStudent({ groupId: g.id });

    const res = await DELETE(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "DELETE",
        params: { id: g.id },
        searchParams: { force: "true" },
      })
    );
    expect(res.status).toBe(200);

    const profile = await getTestDB()
      .prepare("SELECT group_id FROM student_profiles WHERE user_id = ?")
      .bind(s.id)
      .first<{ group_id: string | null }>();
    expect(profile?.group_id).toBeNull();
  });

  it("returns 404 for unknown group", async () => {
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: "nope" } })
    );
    expect(res.status).toBe(404);
  });
});
