import { json } from "@sveltejs/kit"
import { docPages } from "#lib/content/docs.ts"
import { sectionsOf } from "#lib/docs/sections.ts"

export const prerender = true

export const GET = () => json(docPages().flatMap(sectionsOf))
