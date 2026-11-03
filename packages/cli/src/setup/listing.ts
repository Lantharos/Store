import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ApiFailure } from "@schelf/publisher"
import type { Dashboard } from "../api/dashboard.ts"
import type { Project } from "../project/detect.ts"
import { caution, done, step } from "../ui/output.ts"
import type { Identity } from "./identity.ts"
import { imageSize } from "./images.ts"

const MAX_SCREENSHOTS = 8
const MAX_CATEGORIES = 4
const MAX_KEYWORDS = 20

async function bytesOf(root: string, location: string) {
  if (!/^https?:/.test(location)) return new Uint8Array(await readFile(join(root, location)))
  const response = await fetch(location)
  if (!response.ok) throw new Error(`${location} answered ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const reason = (error: unknown) => (error instanceof ApiFailure ? error.detail : (error as Error).message)

export async function importListing(account: Dashboard, project: Project, identity: Identity) {
  const component = project.appstream?.component
  await step("Filling in the listing from the project", async () => {
    await account.putListing(identity.id, "en", {
      name: identity.name,
      summary: identity.summary,
      description: component?.description ?? "",
      keywords: (component?.keywords ?? []).slice(0, MAX_KEYWORDS),
    })
    if (component)
      await account.patchMeta(identity.id, {
        categories: component.categories.slice(0, MAX_CATEGORIES),
        homepage: component.urls.homepage ?? null,
        support: component.urls.bugtracker ?? component.urls.help ?? component.urls.contact ?? null,
        content_rating: component.contentRating?.type ?? null,
        licence: project.licence ?? null,
      })
  })
  if (project.icon) {
    try {
      await account.putIcon(identity.id, await bytesOf(project.root, project.icon))
      done("Uploaded the icon")
    } catch (error) {
      caution(`The icon didn't upload: ${reason(error)}`)
    }
  }
  let uploaded = 0
  for (const screenshot of component?.screenshots.slice(0, MAX_SCREENSHOTS) ?? []) {
    try {
      const bytes = await bytesOf(project.root, screenshot.url)
      const size = imageSize(bytes)
      if (!size) throw new Error("it isn't a PNG or JPEG")
      await account.addScreenshot(identity.id, bytes, size)
      uploaded++
    } catch (error) {
      caution(`${screenshot.url} didn't upload: ${reason(error)}`)
    }
  }
  if (uploaded) done(`Uploaded ${uploaded} screenshot${uploaded === 1 ? "" : "s"}`)
}
