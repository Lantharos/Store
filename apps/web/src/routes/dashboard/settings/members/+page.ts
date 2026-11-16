import { redirect } from "@sveltejs/kit"
import { session } from "#lib/dashboard/api/session.svelte.ts"
import { settingsHref } from "#lib/dashboard/settings/sections.ts"

export async function load({ parent }) {
  await parent()
  if (session.publisher!.kind === "person") redirect(307, settingsHref("profile"))
}
