import type { D1Migration } from "cloudflare:test"

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[]
      TEST_ROOT_KEY: string
      MIGRATION_DB: D1Database
      HOSTING_MIGRATION_DB: D1Database
    }
  }
}
