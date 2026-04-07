import { describe, it, expect } from "vitest";
import { getTestDB } from "../setup/test-env";
import { seedRoles, createTestUser } from "../setup/seed";
import { createMockAPIContext } from "../setup/mock-context";
import { GET, POST } from "../../src/pages/api/admin/parents/index";

const adminUser = { id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] };
const tutorUser = { id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] };

describe("POST /api/admin/parents", () => {
  it("creates user with Parent role", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { email: "parent@test.com", name: "Parent User" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string; roles: string[] } };
    expect(body.data.email).toBe("parent@test.com");
    expect(body.data.roles).toContain("Parent");
  });

  it("creates parent without email", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { name: "No Email Parent", phone: "555-1234" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; email: string | null; name: string; phone: string | null; roles: string[] } };
    expect(body.data.email).toBeNull();
    expect(body.data.name).toBe("No Email Parent");
    expect(body.data.phone).toBe("555-1234");
    expect(body.data.roles).toContain("Parent");

    // Verify the DB row has a placeholder email to satisfy the NOT NULL constraint
    const db = getTestDB();
    const row = await db.prepare("SELECT email FROM users WHERE id = ?").bind(body.data.id).first<{ email: string }>();
    expect(row!.email).toMatch(/@parent\.local$/);
  });

  it("creates parent with empty string email (treated as no email)", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { name: "Parent", email: "" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { email: string | null } };
    expect(body.data.email).toBeNull();
  });

  it("allows creating multiple parents without email", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });

    const db = getTestDB();

    const ctx1 = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Parent One" },
    });
    const res1 = await POST(ctx1);
    expect(res1.status).toBe(201);

    const ctx2 = createMockAPIContext({
      db,
      user: adminUser,
      method: "POST",
      body: { name: "Parent Two" },
    });
    const res2 = await POST(ctx2);
    expect(res2.status).toBe(201);
  });

  it("rejects duplicate email", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "dup-1", email: "dup@test.com", name: "Dup" });

    const ctx = createMockAPIContext({
      db: getTestDB(),
      user: adminUser,
      method: "POST",
      body: { email: "dup@test.com", name: "Duplicate Parent" },
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
      body: { email: "parent@test.com", name: "Parent" },
    });
    const res = await POST(ctx);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/parents", () => {
  it("lists users with Parent role", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "parent-1", email: "parent1@test.com", name: "Parent 1", roles: ["Parent"] });
    await createTestUser({ id: "tutor-1", email: "tutor1@test.com", name: "Tutor 1", roles: ["Tutor"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string | null }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].email).toBe("parent1@test.com");
  });

  it("hides placeholder emails for parents created without an email", async () => {
    await seedRoles();
    await createTestUser({ id: "admin-1", email: "admin@test.com", name: "Admin", roles: ["Admin"] });
    await createTestUser({ id: "p-noemail", email: "p-noemail@parent.local", name: "Parent NoEmail", roles: ["Parent"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: adminUser });
    const res = await GET(ctx);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ name: string; email: string | null }> };
    const parent = body.data.find((p) => p.name === "Parent NoEmail");
    expect(parent).toBeDefined();
    expect(parent!.email).toBeNull();
  });

  it("requires Admin role", async () => {
    await seedRoles();
    await createTestUser({ id: "tutor-1", email: "tutor@test.com", name: "Tutor", roles: ["Tutor"] });

    const ctx = createMockAPIContext({ db: getTestDB(), user: tutorUser });
    const res = await GET(ctx);

    expect(res.status).toBe(403);
  });
});
