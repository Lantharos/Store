import { llmsFull } from "#lib/docs/llms.ts"

export const prerender = true

export const GET = () =>
  new Response(llmsFull(), { headers: { "content-type": "text/plain; charset=utf-8" } })
