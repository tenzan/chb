import { Miniflare } from 'miniflare';
import { beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const g = globalThis as any;

// Skip Miniflare initialization for jsdom (component) tests
const isJsdom = typeof (globalThis as any).window !== 'undefined'
  && typeof (globalThis as any).document !== 'undefined';

let mf: Miniflare;
let db: D1Database;

const TABLES = [
  'password_reset_tokens',
  'subjects',
  'sessions',
  'invites',
  'parent_students',
  'user_roles',
  'users',
  'roles',
];

async function ensureInitialized() {
  if (g.__miniflare_initialized) {
    mf = g.__miniflare_mf;
    db = g.__miniflare_db;
    return;
  }

  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'test-db' },
  });

  db = await mf.getD1Database('DB');

  const migrationsDir = path.resolve('migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter((s) => s.length > 0);

    if (statements.length > 0) {
      try {
        await db.batch(statements.map((s) => db.prepare(s)));
      } catch (err: any) {
        for (const stmt of statements) {
          try {
            await db.batch([db.prepare(stmt)]);
          } catch (e: any) {
            if (
              e.message?.includes('duplicate column') ||
              e.message?.includes('already exists')
            ) {
              continue;
            }
            throw e;
          }
        }
      }
    }
  }

  g.__miniflare_initialized = true;
  g.__miniflare_mf = mf;
  g.__miniflare_db = db;
}

if (!isJsdom) {
  beforeAll(async () => {
    await ensureInitialized();
  });

  beforeEach(async () => {
    await cleanDB();
  });
}

export function getTestDB(): D1Database {
  return db;
}

async function cleanDB() {
  await db.batch(TABLES.map((t) => db.prepare(`DELETE FROM ${t}`)));
}
