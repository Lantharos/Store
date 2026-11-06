import type { Page } from "./page.ts"

const sources = import.meta.glob<Page>("/src/content/docs/**/*.md", { import: "default", eager: true })

const bodies = import.meta.glob<string>("/src/content/docs/**/*.md", { import: "markdown", eager: true })

const pages = new Map(Object.values(sources).map((page) => [page.slug, page]))

const slugOf = (path: string) => path.slice(path.lastIndexOf("/") + 1, -".md".length)

const markdown = new Map(Object.entries(bodies).map(([path, body]) => [slugOf(path), body]))

export const docPage = (slug: string) => pages.get(slug)

export const docPages = () => [...pages.values()]

export const docMarkdown = (slug: string) => markdown.get(slug)

export const docTitles = Object.fromEntries([...pages.values()].map((page) => [page.slug, page.title]))
