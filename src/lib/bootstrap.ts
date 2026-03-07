import { hashPassword } from "./password";
import { generateId } from "./id";

export async function bootstrapAdmin(
  db: D1Database,
  env: { BOOTSTRAP_ADMIN_EMAIL: string; BOOTSTRAP_ADMIN_PASSWORD: string }
): Promise<void> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) return;

  let existing;
  try {
    existing = await db
      .prepare(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name = 'Admin' LIMIT 1`
      )
      .first();
  } catch {
    return;
  }

  if (existing) return;

  const id = generateId();
  const { hash, salt } = await hashPassword(password);

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, salt, name) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, email, hash, salt, "Admin")
    .run();

  const role = await db
    .prepare("SELECT id FROM roles WHERE name = 'Admin'")
    .first<{ id: number }>();

  if (role) {
    await db
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(id, role.id)
      .run();
  }
}
