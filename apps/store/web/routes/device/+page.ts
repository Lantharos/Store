import { redirect } from "@sveltejs/kit"
import { session } from "#lib/dashboard/api/session.svelte.ts"

export const ssr = false

export async function load({ url }) {
  if (!session.loaded) await session.load()
  if (!session.signedIn)
    redirect(307, `/dashboard/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`)
  return { code: url.searchParams.get("user_code") ?? "" }
}
