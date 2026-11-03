import type { Page } from "./page.ts"

const sources = import.meta.glob<Page>("/src/content/docs/**/*.md", { import: "default", eager: true })

const pages = new Map(Object.values(sources).map((page) => [page.slug, page]))

export const docPage = (slug: string) => pages.get(slug)

export const docTitles = Object.fromEntries([...pages.values()].map((page) => [page.slug, page.title]))
