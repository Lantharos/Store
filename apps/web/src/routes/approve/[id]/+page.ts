import { redirect } from "@sveltejs/kit"
import { session } from "#lib/dashboard/api/session.svelte.ts"

export const ssr = false

export async function load({ url, params }) {
  if (!session.loaded) await session.load()
  if (!session.signedIn) redirect(307, `/dashboard/sign-in?next=${encodeURIComponent(url.pathname)}`)
  return { id: params.id }
}
