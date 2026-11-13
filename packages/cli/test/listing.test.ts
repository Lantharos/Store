import { expect, spyOn, test } from "bun:test"
import { type AppSettings, LISTING_TOML, listingToml, listingTomlFor, parseConfig } from "@schelf/protocol"
import { listingOf } from "../src/commands/listing.ts"

const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')

const settings = {
  app: { visibility: "unlisted", listing_requested: false, page_indexed: true },
  listing: {
    en: { name: "Notes", summary: "Notes that stay out of the way", description: "Write.", keywords: [] },
    sq: { name: "Shënime", summary: "Shënime që nuk të pengojnë", description: "", keywords: ["shënime"] },
  },
  meta: {
    icon: "https://dl.schelf.store/media/x/icon.svg",
    categories: ["Office"],
    homepage: "https://example.com",
    support: null,
    privacy_url: null,
    content_rating: null,
    brand_color: "#3e6b4f",
  },
  screenshots: [{ url: "https://dl.schelf.store/media/x/one.svg", caption: "The editor", platform: null }],
} as unknown as AppSettings

test("the store page comes back as a listing.toml that apply takes as it is", async () => {
  const download = spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response(svg)) as unknown as typeof fetch,
  )
  const { listing, images } = await listingOf(settings)
  download.mockRestore()
  expect(images.map((image) => image.path)).toEqual(["icon.svg", "screenshots/1.svg"])
  const read = parseConfig(LISTING_TOML, listingToml, listingTomlFor(listing))
  expect(read.ok && read.value).toEqual({
    name: "Notes",
    summary: "Notes that stay out of the way",
    description: "Write.",
    categories: ["Office"],
    homepage: "https://example.com",
    brand_color: "#3e6b4f",
    icon: "icon.svg",
    screenshots: [{ file: "screenshots/1.svg", caption: "The editor" }],
    indexed: true,
    translations: { sq: { name: "Shënime", summary: "Shënime që nuk të pengojnë", keywords: ["shënime"] } },
  })
})
