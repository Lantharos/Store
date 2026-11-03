import { renderPage } from "./markdown.ts"

const sources = import.meta.glob<string>("/src/content/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

const pages = new Map(
  Object.entries(sources).map(([path, source]) => {
    const slug = path.slice(path.lastIndexOf("/") + 1, -3)
    return [slug, renderPage(slug, source)]
  }),
)

export const docPage = (slug: string) => pages.get(slug)

export const docTitles = Object.fromEntries([...pages.values()].map((page) => [page.slug, page.title]))
