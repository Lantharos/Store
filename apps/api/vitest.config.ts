import path from "node:path"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { importSigningKey } from "@schelf/protocol"
import { defineConfig } from "vitest/config"

const seed = (byte: number) => btoa(String.fromCharCode(...new Uint8Array(32).fill(byte)))
const TEST_ROOT = seed(5)

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      config: true,
      miniflare: {
        d1Databases: ["MIGRATION_DB", "HOSTING_MIGRATION_DB"],
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          BETTER_AUTH_SECRET: "test-auth-secret-that-is-long-enough-for-better-auth",
          UPLOAD_SECRET: "test-upload-secret",
          STORE_SIGNING_KEY: seed(7),
          TEST_ROOT_KEY: TEST_ROOT,
          ROOT_PUBLIC_KEY: (await importSigningKey(TEST_ROOT)).publicKey,
          SEALING_KEY: seed(9),
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
