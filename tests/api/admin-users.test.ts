import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/users/index";
import { POST as rolesHandler } from "../../src/pages/api/admin/users/[id]/roles";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

describe("GET /api/admin/users", () => {
  it("returns list of users with roles (Admin only)", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "other-1", email: "other@test.com", name: "Other User", roles: ["Tutor"] });

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; roles: string[] }> };
    expect(body.data.length).toBe(2);
    const otherUser = body.data.find((u) => u.email === "other@test.com");
    expect(otherUser).toBeTruthy();
    expect(otherUser!.roles).toContain("Tutor");
  });

  it("returns 403 for non-Admin", async () => {
    const ctx = createMockAPIContext({ db: getTestDB(), user: tutorUser });
    const res = await GET(ctx);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/users/:id/roles", () => {
  it("add role to user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const target = await createTestUser({ id: "target-1", email: "target@test.com", name: "Target", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: target.id },
      body: { add: ["Personnel"] },
    });
    const res = await rolesHandler(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Tutor");
    expect(body.data.roles).toContain("Personnel");
  });

  it("remove role from user", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const target = await createTestUser({ id: "target-1", email: "target@test.com", name: "Target", roles: ["Tutor", "Personnel"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: target.id },
      body: { remove: ["Personnel"] },
    });
    const res = await rolesHandler(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Tutor");
    expect(body.data.roles).not.toContain("Personnel");
  });

  it("add and remove simultaneously", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    const target = await createTestUser({ id: "target-1", email: "target@test.com", name: "Target", roles: ["Tutor"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: target.id },
      body: { add: ["Personnel"], remove: ["Tutor"] },
    });
    const res = await rolesHandler(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { roles: string[] } };
    expect(body.data.roles).toContain("Personnel");
    expect(body.data.roles).not.toContain("Tutor");
  });

  it("rejects invalid role names", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "target-1", email: "target@test.com", name: "Target" });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      params: { id: "target-1" },
      body: { add: ["SuperUser"] },
    });
    const res = await rolesHandler(ctx);

    expect(res.status).toBe(400);
  });

  it("404 for non-existent user", async () => {
    await seedRoles();
    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      params: { id: "nonexistent-id" },
      body: { add: ["Admin"] },
    });
    const res = await rolesHandler(ctx);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/users", () => {
  it("create user directly", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: {
        email: "newuser@test.com",
        name: "New User",
        password: "password123",
        roles: ["Tutor"],
      },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("newuser@test.com");
    expect(body.data.roles).toContain("Tutor");
  });
});
