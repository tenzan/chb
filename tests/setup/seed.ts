import { getTestDB } from './test-env';

export async function seedRoles() {
  const db = getTestDB();
  const roles = ['Admin', 'Personnel', 'Tutor', 'Accountant', 'Parent', 'Student'];
  for (const role of roles) {
    await db
      .prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)')
      .bind(role)
      .run();
  }
}

export async function createTestUser(
  options: {
    id?: string;
    email?: string;
    name?: string;
    passwordHash?: string;
    salt?: string;
    roles?: string[];
  } = {}
) {
  const db = getTestDB();
  const {
    id = crypto.randomUUID(),
    email = 'test@example.com',
    name = 'Test User',
    passwordHash = 'fakehash',
    salt = 'fakesalt',
    roles = [],
  } = options;

  await db
    .prepare(
      'INSERT INTO users (id, email, password_hash, salt, name) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, email, passwordHash, salt, name)
    .run();

  for (const roleName of roles) {
    const role = await db
      .prepare('SELECT id FROM roles WHERE name = ?')
      .bind(roleName)
      .first<{ id: number }>();
    if (role) {
      await db
        .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
        .bind(id, role.id)
        .run();
    }
  }

  return { id, email, name };
}
