import { error } from "@sveltejs/kit"
import { docPage, docTitles } from "#lib/content/docs.ts"
import { DOC_ORDER } from "#lib/docs/nav.ts"

export const prerender = true

export const entries = () => DOC_ORDER.filter((slug) => slug !== "getting-started").map((slug) => ({ slug }))

export function load({ params }) {
  const slug = params.slug ?? "getting-started"
  const page = params.slug === "getting-started" ? undefined : docPage(slug)
  if (!page) error(404, "There's no page here in the docs.")
  const position = DOC_ORDER.indexOf(slug)
  const neighbour = (offset: number) => {
    const next = DOC_ORDER[position + offset]
    return next ? { slug: next, title: docTitles[next]! } : null
  }
  return { page, titles: docTitles, previous: neighbour(-1), next: neighbour(1) }
}
