import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, clearTables, seedRoles, createTestUser } from "../helpers/setup";
import { hashPassword } from "../../src/lib/password";
import { createSession } from "../../src/lib/session";

beforeEach(async () => {
  await applyMigrations();
  await clearTables();
  await seedRoles();
});

async function loginAsAdmin() {
  const { hash, salt } = await hashPassword("password123");
  const user = await createTestUser({
    email: "admin@test.com",
    name: "Admin",
    passwordHash: hash,
    salt,
    roles: ["Admin"],
  });
  const { token } = await createSession(env.DB, user.id);
  return { user, token };
}

async function createParent(email: string = "parent@test.com") {
  const parent = await createTestUser({
    id: crypto.randomUUID(),
    email,
    name: "Parent User",
    roles: ["Parent"],
  });
  return parent;
}

describe("POST /api/admin/students", () => {
  it("creates student linked to parent", async () => {
    const { token } = await loginAsAdmin();
    const parent = await createParent();

    const res = await SELF.fetch("http://localhost/api/admin/students", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Student Name",
        parentUserId: parent.id,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { name: string; parentUserId: string } };
    expect(body.data.name).toBe("Student Name");
    expect(body.data.parentUserId).toBe(parent.id);

    // Verify link exists
    const link = await env.DB.prepare(
      "SELECT * FROM parent_students WHERE parent_user_id = ?"
    )
      .bind(parent.id)
      .first();
    expect(link).not.toBeNull();
  });

  it("validates parentUserId exists and has Parent role", async () => {
    const { token } = await loginAsAdmin();
    const tutor = await createTestUser({
      id: crypto.randomUUID(),
      email: "tutor@test.com",
      name: "Tutor",
      roles: ["Tutor"],
    });

    const res = await SELF.fetch("http://localhost/api/admin/students", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Student",
        parentUserId: tutor.id,
      }),
    });

    expect(res.status).toBe(400);
  });

  it("birthday is optional", async () => {
    const { token } = await loginAsAdmin();
    const parent = await createParent();

    const res = await SELF.fetch("http://localhost/api/admin/students", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Student No Birthday",
        parentUserId: parent.id,
        description: "Some desc",
      }),
    });

    expect(res.status).toBe(201);
  });

  it("requires Admin role", async () => {
    const user = await createTestUser({
      id: crypto.randomUUID(),
      email: "tutor@test.com",
      name: "Tutor",
      roles: ["Tutor"],
    });
    const { token } = await createSession(env.DB, user.id);

    const res = await SELF.fetch("http://localhost/api/admin/students", {
      method: "POST",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Student",
        parentUserId: "some-id",
      }),
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/students", () => {
  it("lists all students with parent info", async () => {
    const { token } = await loginAsAdmin();
    const parent = await createParent();

    // Create a student and link to parent
    const studentId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO students (id, name) VALUES (?, ?)"
    )
      .bind(studentId, "Test Student")
      .run();
    await env.DB.prepare(
      "INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)"
    )
      .bind(parent.id, studentId)
      .run();

    const res = await SELF.fetch("http://localhost/api/admin/students", {
      headers: { Cookie: `session=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ name: string; parents: Array<{ id: string; name: string }> }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Test Student");
    expect(body.data[0].parents.length).toBe(1);
    expect(body.data[0].parents[0].name).toBe("Parent User");
  });

  it("filters by parentUserId", async () => {
    const { token } = await loginAsAdmin();
    const parent1 = await createParent("parent1@test.com");
    const parent2 = await createParent("parent2@test.com");

    // Create students
    const s1 = crypto.randomUUID();
    const s2 = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(s1, "Student 1").run();
    await env.DB.prepare("INSERT INTO students (id, name) VALUES (?, ?)").bind(s2, "Student 2").run();
    await env.DB.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent1.id, s1).run();
    await env.DB.prepare("INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)").bind(parent2.id, s2).run();

    const res = await SELF.fetch(
      `http://localhost/api/admin/students?parentUserId=${parent1.id}`,
      { headers: { Cookie: `session=${token}` } }
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ name: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Student 1");
  });
});

describe("PATCH /api/admin/students/:id", () => {
  it("updates student fields", async () => {
    const { token } = await loginAsAdmin();
    const studentId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO students (id, name) VALUES (?, ?)"
    )
      .bind(studentId, "Original Name")
      .run();

    const res = await SELF.fetch(
      `http://localhost/api/admin/students/${studentId}`,
      {
        method: "PATCH",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Updated Name", note: "Some note" }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { name: string; note: string } };
    expect(body.data.name).toBe("Updated Name");
    expect(body.data.note).toBe("Some note");
  });

  it("404 for non-existent student", async () => {
    const { token } = await loginAsAdmin();

    const res = await SELF.fetch(
      "http://localhost/api/admin/students/nonexistent-id",
      {
        method: "PATCH",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Updated" }),
      }
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/students/:id/link-parent", () => {
  it("creates parent-student link", async () => {
    const { token } = await loginAsAdmin();
    const parent = await createParent();
    const studentId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO students (id, name) VALUES (?, ?)"
    )
      .bind(studentId, "Student")
      .run();

    const res = await SELF.fetch(
      `http://localhost/api/admin/students/${studentId}/link-parent`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parentUserId: parent.id }),
      }
    );

    expect(res.status).toBe(200);
  });

  it("rejects if link already exists", async () => {
    const { token } = await loginAsAdmin();
    const parent = await createParent();
    const studentId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO students (id, name) VALUES (?, ?)"
    )
      .bind(studentId, "Student")
      .run();
    await env.DB.prepare(
      "INSERT INTO parent_students (parent_user_id, student_id) VALUES (?, ?)"
    )
      .bind(parent.id, studentId)
      .run();

    const res = await SELF.fetch(
      `http://localhost/api/admin/students/${studentId}/link-parent`,
      {
        method: "POST",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parentUserId: parent.id }),
      }
    );

    expect(res.status).toBe(409);
  });
});
