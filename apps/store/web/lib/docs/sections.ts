import type { Page } from "../content/page.ts"
import type { DocSection } from "./search.ts"

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }

const plainText = (html: string) =>
  html
    .replace(/<button.*?<\/button>/gs, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => ENTITIES[entity]!)
    .replace(/\s+/g, " ")
    .trim()

export function sectionsOf(page: Page): DocSection[] {
  const [intro, ...rest] = page.html.split(/(?=<h2 id=")/)
  const section = (id: string | null, heading: string | null, html: string): DocSection => ({
    slug: page.slug,
    id,
    page: page.title,
    heading,
    text: plainText(html),
  })
  return [
    section(null, null, intro!),
    ...rest.map((html, index) => {
      const heading = page.headings[index]!
      return section(heading.id, heading.text, html.slice(html.indexOf("</h2>") + "</h2>".length))
    }),
  ]
}
