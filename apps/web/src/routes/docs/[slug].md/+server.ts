import { error } from "@sveltejs/kit"
import { docAsMarkdown } from "#lib/docs/llms.ts"
import { DOC_ORDER } from "#lib/docs/nav.ts"

export const prerender = true

export const entries = () => DOC_ORDER.map((slug) => ({ slug }))

export function GET({ params }) {
  const markdown = docAsMarkdown(params.slug)
  if (!markdown) error(404, "There's no page here in the docs.")
  return new Response(markdown, { headers: { "content-type": "text/markdown; charset=utf-8" } })
}
