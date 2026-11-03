import type { Page } from "./page.ts"

const sources = import.meta.glob<Page>("/src/content/legal/*.md", { import: "default", eager: true })

export const LEGAL_PAGES = new Map(Object.values(sources).map((page) => [page.slug, page]))
