import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
        miniflare: {
          d1Databases: ["DB"],
          // TODO: Uncomment when R2 is enabled
          // r2Buckets: ["STORAGE"],
          bindings: {
            BASE_URL: "http://localhost:8787",
            BOOTSTRAP_ADMIN_EMAIL: "admin@test.com",
            BOOTSTRAP_ADMIN_PASSWORD: "TestPassword123!",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          },
        },
      },
    },
  },
});
