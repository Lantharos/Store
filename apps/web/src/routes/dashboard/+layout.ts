import { redirect } from "@sveltejs/kit"
import { session } from "#lib/dashboard/api/session.svelte.ts"

export const ssr = false

const OPEN = ["/dashboard/sign-in"]
const WITHOUT_PUBLISHER = ["/dashboard/welcome", "/dashboard/invites"]

export async function load({ url }) {
  if (!session.loaded) await session.load()
  const open = OPEN.includes(url.pathname)
  if (!session.signedIn && !open)
    redirect(307, `/dashboard/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`)
  if (session.signedIn && open) redirect(307, url.searchParams.get("next") ?? "/dashboard")
  if (!session.signedIn) return
  const chosen = url.searchParams.get("publisher")
  if (chosen) await session.use(chosen)
  if (!session.publisher && !WITHOUT_PUBLISHER.includes(url.pathname)) redirect(307, "/dashboard/welcome")
}
