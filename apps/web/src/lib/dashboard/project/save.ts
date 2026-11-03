import type { AppSettings, UpdateHosting } from "@schelf/protocol"
import { toasts } from "../../ui/overlay/toasts.svelte.ts"
import { api } from "../api/client.ts"
import { endpoints } from "../api/endpoints.ts"
import { session } from "../api/session.svelte.ts"

export async function saveHosting(settings: AppSettings, change: UpdateHosting) {
  try {
    const next = await api.patch<AppSettings>(endpoints.hosting(settings.app.id), change)
    await session.refreshApps()
    return next
  } catch (error) {
    toasts.show((error as Error).message, "danger")
    return { ...settings }
  }
}
