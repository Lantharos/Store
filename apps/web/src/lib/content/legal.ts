import { renderPage } from "./markdown.ts"

const sources = import.meta.glob<string>("/src/content/legal/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

export const LEGAL_PAGES = new Map(
  Object.entries(sources).map(([path, source]) => {
    const slug = path.slice(path.lastIndexOf("/") + 1, -3)
    return [slug, renderPage(slug, source)]
  }),
)
