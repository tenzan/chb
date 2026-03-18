import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/subjects/index";
import { PATCH, DELETE } from "../../src/pages/api/admin/subjects/[id]";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

describe("POST /api/admin/subjects", () => {
  it("creates a subject", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { name: "Physics", description: "Study of matter and energy" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; name: string; description: string } };
    expect(body.data.name).toBe("Physics");
    expect(body.data.description).toBe("Study of matter and energy");
    expect(body.data.id).toBeDefined();
  });

  it("creates a subject without description", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { name: "Chemistry" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { name: string; description: string | null } };
    expect(body.data.name).toBe("Chemistry");
    expect(body.data.description).toBeNull();
  });

  it("rejects duplicate subject name", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db
      .prepare("INSERT INTO subjects (id, name) VALUES (?, ?)")
      .bind("subj-1", "Physics")
      .run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Physics" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(409);
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
      body: { name: "Physics" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/subjects", () => {
  it("lists all subjects", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s1", "Physics").run();
    await db.prepare("INSERT INTO subjects (id, name, description) VALUES (?, ?, ?)").bind("s2", "Chemistry", "Study of substances").run();

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; name: string }> };
    expect(body.data.length).toBe(2);
  });

  it("returns empty array when no subjects", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<any> };
    expect(body.data.length).toBe(0);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: tutorUser });
    const res = await GET(ctx);

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/subjects/:id", () => {
  it("updates subject name", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s1", "Physcis").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: "s1" },
      body: { name: "Physics" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string } };
    expect(body.data.name).toBe("Physics");
  });

  it("updates subject description", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s1", "Physics").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: "s1" },
      body: { description: "Study of matter" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { description: string } };
    expect(body.data.description).toBe("Study of matter");
  });

  it("returns 404 for non-existent subject", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "PATCH",
      params: { id: "nonexistent" },
      body: { name: "Physics" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(404);
  });

  it("rejects duplicate name on update", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s1", "Physics").run();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s2", "Chemistry").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "PATCH",
      params: { id: "s2" },
      body: { name: "Physics" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(409);
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: tutorUser,
      method: "PATCH",
      params: { id: "s1" },
      body: { name: "Physics" },
    });
    const res = await PATCH(ctx);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/subjects/:id", () => {
  it("deletes a subject", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();
    await db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").bind("s1", "Physics").run();

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "DELETE",
      params: { id: "s1" },
    });
    const res = await DELETE(ctx);

    expect(res.status).toBe(200);

    const check = await db.prepare("SELECT id FROM subjects WHERE id = ?").bind("s1").first();
    expect(check).toBeNull();
  });

  it("returns 404 for non-existent subject", async () => {
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
      params: { id: "s1" },
    });
    const res = await DELETE(ctx);

    expect(res.status).toBe(403);
  });
});
