import { defineConfig } from "astro/config";
import { execSync } from "node:child_process";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";

const commitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const commitShaFull = (() => {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      configPath: "wrangler.dev.toml",
    },
  }),
  integrations: [tailwind(), react()],
  vite: {
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
      __COMMIT_SHA_FULL__: JSON.stringify(commitShaFull),
    },
    resolve: {
      // React 19's default server renderer needs MessageChannel, which
      // Cloudflare Workers lack; use the edge build in production.
      alias: import.meta.env.PROD
        ? { "react-dom/server": "react-dom/server.edge" }
        : {},
    },
  },
});
