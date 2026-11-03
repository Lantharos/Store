import { error } from "@sveltejs/kit"
import { LEGAL_PAGES } from "#lib/content/legal.ts"

export const prerender = true

export const entries = () => [...LEGAL_PAGES.keys()].map((doc) => ({ doc }))

export function load({ params }) {
  const page = LEGAL_PAGES.get(params.doc)
  if (!page) error(404, "There's no page here.")
  return { page }
}
