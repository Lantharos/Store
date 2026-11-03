import { redirect } from "@sveltejs/kit"
import { settingsHref } from "#lib/dashboard/settings/sections.ts"

export function load() {
  redirect(307, settingsHref("profile"))
}
