import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import {
  type AppSettings,
  DEFAULT_LOCALE,
  LISTING_TOML,
  type ListingToml,
  listingTomlFor,
  readSchelfToml,
  sniffImage,
} from "@schelf/protocol"
import type { Args } from "../args.ts"
import { configPlace } from "../project/config.ts"
import { readOptional } from "../project/files.ts"
import { LISTING_FOLDER } from "../setup/listing.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, emit, Failure, field, note, title } from "../ui/output.ts"
import { signedIn, verbs } from "./context.ts"

interface Image {
  path: string
  bytes: Uint8Array
}

async function image(url: string, name: string): Promise<Image> {
  const response = await fetch(url)
  if (!response.ok) throw new Failure(`Couldn't download ${url}`, `It answered ${response.status}.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const sniffed = sniffImage(bytes, true)
  if (!sniffed) throw new Failure(`${url} isn't a PNG, JPEG, WebP or SVG`)
  return { path: `${name}.${sniffed.extension}`, bytes }
}

const unset = <T extends object>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  ) as T

export async function listingOf(settings: AppSettings) {
  const { [DEFAULT_LOCALE]: english, ...others } = settings.listing
  if (!english) throw new Failure("The store page has no English name and summary yet")
  const icon = settings.meta.icon ? await image(settings.meta.icon, "icon") : undefined
  const shots = await Promise.all(
    settings.screenshots.map((shot, index) => image(shot.url, `screenshots/${index + 1}`)),
  )
  const listing: ListingToml = unset({
    name: english.name,
    summary: english.summary,
    description: english.description,
    keywords: english.keywords.length ? english.keywords : undefined,
    categories: settings.meta.categories.length ? settings.meta.categories : undefined,
    homepage: settings.meta.homepage ?? undefined,
    support: settings.meta.support ?? undefined,
    privacy_url: settings.meta.privacy_url ?? undefined,
    content_rating: settings.meta.content_rating ?? undefined,
    brand_color: settings.meta.brand_color ?? undefined,
    icon: icon?.path,
    screenshots: shots.length
      ? shots.map((shot, index) => {
          const { caption, platform } = settings.screenshots[index]!
          return caption || platform
            ? unset({ file: shot.path, caption: caption ?? undefined, platform: platform ?? undefined })
            : shot.path
        })
      : undefined,
    listed: settings.app.visibility === "listed" || settings.app.listing_requested || undefined,
    indexed: settings.app.visibility === "unlisted" && settings.app.page_indexed ? true : undefined,
    translations: Object.keys(others).length
      ? Object.fromEntries(
          Object.entries(others).map(([locale, words]) => [
            locale,
            unset({ ...words, keywords: words.keywords.length ? words.keywords : undefined }),
          ]),
        )
      : undefined,
  })
  return { listing, images: [...(icon ? [icon] : []), ...shots] }
}

async function pull(args: Args) {
  const place = await configPlace(args)
  const text = await readOptional(place.config)
  if (text === undefined)
    throw new Failure(
      "There's no schelf.toml here",
      "Run this in the app's folder, or pass --config.",
      EXIT.usage,
    )
  const manifest = readSchelfToml(text)
  const folder = join(place.folder, manifest.listing ?? LISTING_FOLDER)
  const file = join(folder, LISTING_TOML)
  if ((await readOptional(file)) !== undefined && !args.flags.has("force"))
    throw new Failure(
      `${relative(process.cwd(), file)} exists already`,
      "Pass --force to replace it with what the store has.",
      EXIT.usage,
    )
  const context = await signedIn(args)
  const id = manifest.id ?? manifest.project!
  const settings = await context.dashboard.app(id)
  const { listing, images } = await listingOf(settings)
  await mkdir(folder, { recursive: true })
  for (const each of images) {
    await mkdir(dirname(join(folder, each.path)), { recursive: true })
    await writeFile(join(folder, each.path), each.bytes)
  }
  await writeFile(file, listingTomlFor(listing))
  emit({ file: relative(process.cwd(), file), images: images.map((each) => each.path), listing })
  title(`The store page of ${settings.app.name}`)
  field("Wrote", relative(process.cwd(), file))
  for (const each of images) field("Saved", relative(process.cwd(), join(folder, each.path)))
  blank()
  if (!manifest.listing) note(`Add listing = "${LISTING_FOLDER}" to schelf.toml so schelf apply sends it.`)
  done("The listing is in your files now; change it there and run schelf apply")
  blank()
  return EXIT.ok
}

export const listing = verbs("listing", {
  pull: {
    usage: "pull [--force]",
    about: "Write the store page as it is now into listing.toml, with its icon and screenshots",
    run: pull,
  },
})
