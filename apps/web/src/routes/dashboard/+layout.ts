import { redirect } from "@sveltejs/kit"
import { session } from "#lib/dashboard/api/session.svelte.ts"

export const ssr = false

const OPEN = ["/dashboard/sign-in"]

export async function load({ url }) {
  if (!session.loaded) await session.load()
  const open = OPEN.includes(url.pathname)
  if (!session.signedIn && !open)
    redirect(307, `/dashboard/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`)
  if (session.signedIn && open) redirect(307, url.searchParams.get("next") ?? "/dashboard")
  if (session.signedIn && !session.account?.developer && url.pathname !== "/dashboard/welcome")
    redirect(307, "/dashboard/welcome")
}
