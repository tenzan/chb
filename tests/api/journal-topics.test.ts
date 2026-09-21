import { describe, it, expect, beforeEach } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser, createTestTopicCategory } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/journal/topics/index";
import { DELETE } from "../../src/pages/api/journal/topics/[id]";
import { POST as POST_CATEGORY } from "../../src/pages/api/journal/topic-categories/index";

const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };
const parentUser = { id: "parent-1", email: "parent@test.com", name: "Parent", roles: ["Parent"] };

beforeEach(async () => {
  await seedRoles();
  await createTestUser({ id: "tutor-1", email: "tutor@test.com", roles: ["Tutor"] });
});

async function addTopic(categoryId: string, text: string) {
  return POST(
    createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "POST",
      body: { categoryId, text },
    })
  );
}

describe("GET /api/journal/topics", () => {
  it("returns categories in order with their topics", async () => {
    const b = await createTestTopicCategory({ name: "Геометрия", position: 2 });
    const a = await createTestTopicCategory({ name: "Основы", position: 1 });
    await addTopic(a.id, "Сравнение чисел");
    await addTopic(a.id, "Дроби");
    await addTopic(b.id, "Углы");

    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any[] };

    expect(body.data.map((c) => c.name)).toEqual(["Основы", "Геометрия"]);
    expect(body.data[0].topics.map((t: any) => t.text)).toEqual(["Сравнение чисел", "Дроби"]);
    expect(body.data[0].topics[0].id).toBeDefined();
    expect(body.data[1].topics).toHaveLength(1);
  });

  it("includes empty categories", async () => {
    await createTestTopicCategory({ name: "Пусто" });
    const res = await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }));
    const body = (await res.json()) as { data: any[] };
    expect(body.data).toEqual([expect.objectContaining({ name: "Пусто", topics: [] })]);
  });

  it("returns 403 without journal role", async () => {
    const res = await GET(createMockAPIContext({ db: getTestDB(), user: parentUser }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/journal/topics", () => {
  it("adds a trimmed topic to a category", async () => {
    const c = await createTestTopicCategory();
    const res = await addTopic(c.id, "  Проценты  ");
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({ categoryId: c.id, text: "Проценты" });
  });

  it("rejects a duplicate topic in the same category", async () => {
    const c = await createTestTopicCategory();
    await addTopic(c.id, "Проценты");
    const res = await addTopic(c.id, "Проценты");
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown category", async () => {
    const res = await addTopic("nope", "X");
    expect(res.status).toBe(404);
  });

  it("rejects empty text", async () => {
    const c = await createTestTopicCategory();
    const res = await addTopic(c.id, " ");
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/journal/topics/:id", () => {
  it("removes the topic", async () => {
    const c = await createTestTopicCategory();
    const created = (await (await addTopic(c.id, "Проценты")).json()) as { data: { id: string } };

    const res = await DELETE(
      createMockAPIContext({
        db: getTestDB(),
        user: tutorUser,
        method: "DELETE",
        params: { id: created.data.id },
      })
    );
    expect(res.status).toBe(200);

    const list = (await (
      await GET(createMockAPIContext({ db: getTestDB(), user: tutorUser }))
    ).json()) as { data: any[] };
    expect(list.data[0].topics).toEqual([]);
  });

  it("returns 404 for unknown topic", async () => {
    const res = await DELETE(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "DELETE", params: { id: "nope" } })
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/journal/topic-categories", () => {
  it("creates a category", async () => {
    const res = await POST_CATEGORY(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "POST", body: { name: "Алгебра" } })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: any };
    expect(body.data).toMatchObject({ name: "Алгебра", topics: [] });
  });

  it("rejects a duplicate name", async () => {
    await createTestTopicCategory({ name: "Алгебра" });
    const res = await POST_CATEGORY(
      createMockAPIContext({ db: getTestDB(), user: tutorUser, method: "POST", body: { name: "Алгебра" } })
    );
    expect(res.status).toBe(409);
  });
});
