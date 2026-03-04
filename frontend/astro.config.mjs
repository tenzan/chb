import { defineConfig } from "astro/config";
import { execSync } from "node:child_process";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

const commitSha = (() => {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "unknown"; }
})();

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [react(), tailwind()],
  vite: {
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
  },
});
