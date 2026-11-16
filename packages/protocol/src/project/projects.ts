import { z } from "zod"

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const RESERVED_SLUGS = new Set([
  "api",
  "apps",
  "categories",
  "dashboard",
  "device",
  "docs",
  "embed",
  "extensions",
  "index",
  "invited",
  "legal",
  "mail",
  "media",
  "private",
  "publishers",
  "report",
  "sabine",
  "search",
  "trust",
])

export const projectSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG, "Use lowercase letters, numbers and dashes")
  .max(40)

export const PROJECT_PATH = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/

export const projectPath = z
  .string()
  .regex(PROJECT_PATH, "A project is named publisher/project, like lantharos/raffi")

export function splitProjectPath(path: string) {
  const [, publisher, project] = PROJECT_PATH.exec(path) ?? []
  return publisher && project ? { publisher, project } : null
}

export function projectId(publisherSlug: string, slug: string) {
  return `${publisherSlug}.${slug}`
}

export function slugFromId(id: string) {
  return (
    id
      .slice(id.lastIndexOf(".") + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "app"
  )
}

export const VISIBILITIES = ["listed", "unlisted"] as const
export const visibility = z.enum(VISIBILITIES)
export type Visibility = z.infer<typeof visibility>

export function isProjectId(id: string) {
  return id.split(".").length === 2
}
