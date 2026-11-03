import type { System } from "@schelf/protocol"

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
