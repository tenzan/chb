/// <reference path="../.astro/types.d.ts" />

declare const __COMMIT_SHA__: string;

type D1Database = import("@cloudflare/workers-types").D1Database;

type Runtime = import("@astrojs/cloudflare").Runtime<{
  DB: D1Database;
  BOOTSTRAP_ADMIN_EMAIL: string;
  BOOTSTRAP_ADMIN_PASSWORD: string;
  TURNSTILE_SECRET_KEY: string;
  GITHUB_TOKEN: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}>;

declare namespace App {
  interface Locals extends Runtime {
    user?: {
      id: string;
      email: string;
      name: string;
      roles: string[];
    };
  }
}
