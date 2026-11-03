import type { System } from "#lib/system/detect.ts"

declare global {
  namespace App {
    interface Locals {
      system: System
    }
  }

  namespace Cloudflare {
    interface Env {
      API: { fetch: typeof fetch }
    }
  }

  interface CacheStorage {
    readonly default: Cache
  }
}
