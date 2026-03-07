import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/users/index";
import { POST as rolesHandler } from "../../src/pages/api/admin/users/[id]/roles";

import { toHex, randomBytes, sha256 } from "../../src/lib/crypto";
import { generateId } from "../../src/lib/id";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

describe("GET /api/admin/users", () => {
  it("returns all users with roles and student parents", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "tutor-2", email: "tutor2@test.com", name: "Tutor User", roles: ["Tutor"] });
    await createTestUser({ id: "parent-1", email: "parent@test.com", name: "Parent User", roles: ["Parent"] });
    await createTestUser({ id: "student-1", email: "student@test.com", name: "Student User", roles: ["Student"] });

    // Link parent to student
    await db.prepare("INSERT INTO parent_students (parent_id, student_id) VALUES (?, ?)").bind("parent-1", "student-1").run();

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; status: string; roles: string[]; parents: Array<{ id: string; name: string }> }> };
    // Should return ALL users
    expect(body.data.length).toBe(4);

    // Should include status field
    expect(body.data[0].status).toBe("active");
    const emails = body.data.map(u => u.email);
    expect(emails).toContain("admin@test.com");
    expect(emails).toContain("tutor2@test.com");
    expect(emails).toContain("parent@test.com");
    expect(emails).toContain("student@test.com");

    // Student should have linked parents
    const student = body.data.find(u => u.email === "student@test.com")!;
    expect(student.parents.length).toBe(1);
    expect(student.parents[0].name).toBe("Parent User");
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

describe("GET /api/admin/users - pending user inviteId", () => {
  it("returns inviteId for pending users", async () => {
    await seedRoles();
    const db = getTestDB();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    // Create a pending user with an active invite
    const pendingId = generateId();
    await db.prepare("INSERT INTO users (id, email, name, status) VALUES (?, ?, ?, 'pending')")
      .bind(pendingId, "pending@test.com", "")
      .run();

    const inviteId = generateId();
    const rawToken = toHex(randomBytes(32));
    const tokenHash = await sha256(rawToken);
    await db.prepare(
      "INSERT INTO invites (id, email, role_name, token_hash, token, expires_at, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(inviteId, "pending@test.com", "Tutor", tokenHash, rawToken, new Date(Date.now() + 86400000).toISOString(), "admin-1").run();

    const ctx = createMockAPIContext({ db, user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string; status: string; inviteId?: string }> };
    const pending = body.data.find(u => u.email === "pending@test.com")!;
    expect(pending.status).toBe("pending");
    expect(pending.inviteId).toBe(inviteId);

    // Active user should not have inviteId
    const admin = body.data.find(u => u.email === "admin@test.com")!;
    expect(admin.inviteId).toBeUndefined();
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
