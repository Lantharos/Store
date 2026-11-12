import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  LISTING_TOML,
  type ListingToml,
  listingTomlFor,
  MAX_CATEGORIES,
  MAX_KEYWORDS,
  MAX_SCREENSHOTS,
  sniffImage,
} from "@schelf/protocol"
import type { Project } from "../project/detect.ts"
import { readOptional } from "../project/files.ts"
import { caution } from "../ui/output.ts"
import type { PlannedFile } from "./files.ts"
import type { Identity } from "./identity.ts"

export const LISTING_FOLDER = "store"

async function bytesOf(root: string, location: string) {
  if (!/^https?:/.test(location)) return new Uint8Array(await readFile(join(root, location)))
  const response = await fetch(location)
  if (!response.ok) throw new Error(`${location} answered ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function copied(root: string, location: string, name: string) {
  try {
    const bytes = await bytesOf(root, location)
    const image = sniffImage(bytes, true)
    if (!image) throw new Error("it isn't a PNG, JPEG, WebP or SVG")
    return { path: `${name}.${image.extension}`, bytes }
  } catch (error) {
    caution(`Left out ${location}: ${(error as Error).message}`)
    return undefined
  }
}

const inFolder = (location: string) => location.startsWith(`${LISTING_FOLDER}/`)

export async function listingFiles(project: Project, identity: Identity): Promise<PlannedFile[]> {
  const file = `${LISTING_FOLDER}/${LISTING_TOML}`
  if ((await readOptional(join(project.root, file))) !== undefined) return []
  const component = project.appstream?.component
  const media: PlannedFile[] = []
  const place = async (location: string, name: string) => {
    if (inFolder(location) && !/^https?:/.test(location)) return location.slice(LISTING_FOLDER.length + 1)
    const image = await copied(project.root, location, name)
    if (!image) return undefined
    media.push({ path: `${LISTING_FOLDER}/${image.path}`, contents: image.bytes })
    return image.path
  }
  const icon = project.icon ? await place(project.icon, "icon") : undefined
  const screenshots: string[] = []
  for (const [index, shot] of (component?.screenshots ?? []).slice(0, MAX_SCREENSHOTS).entries()) {
    const placed = await place(shot.url, `screenshots/${index + 1}`)
    if (placed) screenshots.push(placed)
  }
  const listing: ListingToml = {
    name: identity.name,
    summary: identity.summary,
    description: component?.description || project.sabine?.description || undefined,
    keywords: component?.keywords.length ? component.keywords.slice(0, MAX_KEYWORDS) : undefined,
    categories: component?.categories.length ? component.categories.slice(0, MAX_CATEGORIES) : undefined,
    homepage: component?.urls.homepage,
    support: component?.urls.bugtracker ?? component?.urls.help ?? component?.urls.contact,
    content_rating: component?.contentRating?.type,
    icon,
    screenshots: screenshots.length ? screenshots : undefined,
  }
  const defined = Object.fromEntries(
    Object.entries(listing).filter(([, value]) => value !== undefined),
  ) as ListingToml
  return [{ path: file, contents: listingTomlFor(defined) }, ...media]
}
