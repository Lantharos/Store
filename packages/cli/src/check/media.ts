import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { joinConfigPath, type ListingToml, screenshotFile, sniffImage } from "@schelf/protocol"
import type { Issue } from "./issues.ts"

const MIN_SCREENSHOT_EDGE = 640
const MIN_ICON_EDGE = 256

async function imageAt(root: string, path: string) {
  try {
    return { image: sniffImage(new Uint8Array(await readFile(join(root, path))), true) }
  } catch {
    return undefined
  }
}

export async function mediaIssues(root: string, folder: string, file: string, listing: ListingToml) {
  const issues: Issue[] = []
  const problem = (key: string, message: string) => issues.push({ level: "error", file, key, message })
  if (listing.icon) {
    const found = await imageAt(root, joinConfigPath(folder, listing.icon))
    if (!found) problem("icon", `${listing.icon} isn't in ${folder}`)
    else if (!found.image) problem("icon", `${listing.icon} isn't a PNG, JPEG, WebP or SVG`)
    else if (found.image.width !== found.image.height) problem("icon", `${listing.icon} isn't square`)
    else if (found.image.extension !== "svg" && found.image.width < MIN_ICON_EDGE)
      problem(
        "icon",
        `${listing.icon} is ${found.image.width} pixels wide; icons are an SVG or at least ${MIN_ICON_EDGE} pixels`,
      )
  }
  for (const [index, entry] of (listing.screenshots ?? []).entries()) {
    const shot = screenshotFile(entry).file
    const key = `screenshots.${index}`
    const found = await imageAt(root, joinConfigPath(folder, shot))
    if (!found) problem(key, `${shot} isn't in ${folder}`)
    else if (!found.image || found.image.extension === "svg")
      problem(key, `${shot} isn't a PNG, JPEG or WebP`)
    else if (Math.min(found.image.width, found.image.height) < MIN_SCREENSHOT_EDGE)
      problem(
        key,
        `${shot} is ${found.image.width}×${found.image.height}; screenshots are at least ${MIN_SCREENSHOT_EDGE} pixels on each side`,
      )
  }
  return issues
}
