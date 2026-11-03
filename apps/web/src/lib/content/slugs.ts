const fileSlug = (path: string) => path.slice(path.lastIndexOf("/") + 1, -3)

export const LEGAL_SLUGS = Object.keys(import.meta.glob("/src/content/legal/*.md")).map(fileSlug)
