import type { AppSettings, UpdateHosting } from "@schelf/protocol"
import { attempt } from "../../ui/overlay/task.svelte.ts"
import { api } from "../api/client.ts"
import { endpoints } from "../api/endpoints.ts"
import { session } from "../api/session.svelte.ts"

export async function saveHosting(settings: AppSettings, change: UpdateHosting) {
  const saved = await attempt(async () => {
    const next = await api.patch<AppSettings>(endpoints.hosting(settings.app.id), change)
    await session.refreshApps()
    return next
  })
  return saved ?? { ...settings }
}
