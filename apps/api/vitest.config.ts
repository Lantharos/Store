import path from "node:path"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          BETTER_AUTH_SECRET: "test-auth-secret-that-is-long-enough-for-better-auth",
          UPLOAD_SECRET: "test-upload-secret",
          STORE_SIGNING_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
          REVIEWER_TOKEN: "test-reviewer",
          GITHUB_CLIENT_ID: "",
          GITHUB_CLIENT_SECRET: "",
          GITHUB_TOKEN: "",
          ANALYTICS_TOKEN: "",
          PULT_KEY: "",
        },
      },
    })),
  ],
  test: { setupFiles: ["./test/setup.ts"] },
})
