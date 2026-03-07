import { defineConfig } from "astro/config";
import { execSync } from "node:child_process";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

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
  integrations: [tailwind()],
  vite: {
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
      __COMMIT_SHA_FULL__: JSON.stringify(commitShaFull),
    },
  },
});
