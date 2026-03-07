import { execSync } from "node:child_process";
import { existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

export default function globalSetup() {
  const root = join(import.meta.dirname, "../..");
  const d1Dir = join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

  // Only delete DB files if no dev server is currently using them.
  // The webServer config will start a fresh one after this.
  if (existsSync(d1Dir)) {
    // Delete all SQLite files (db, wal, shm)
    for (const file of readdirSync(d1Dir)) {
      if (file.endsWith(".sqlite") || file.endsWith(".sqlite-wal") || file.endsWith(".sqlite-shm")) {
        rmSync(join(d1Dir, file), { force: true });
      }
    }
  }

  // Re-apply migrations to get a fresh schema
  execSync("npm run db:migrate:local", { cwd: root, stdio: "inherit" });
}
