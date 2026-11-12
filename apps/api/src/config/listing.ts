import {
  type ConfigChange,
  type ConfigIssue,
  type ConfigMedia,
  DEFAULT_LOCALE,
  joinConfigPath,
  type ListingText,
  type ListingToml,
  screenshotFile,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import type { AppRow } from "../signing/records.ts"
import type { StoredMedia } from "./media.ts"

const MIN_SCREENSHOT_EDGE = 640

type Meta = Omit<typeof schema.listingMeta.$inferInsert, "appId">
type Shot = Omit<typeof schema.screenshot.$inferInsert, "id" | "appId">

export interface DesiredListing {
  file: string
  locales: Map<string, ListingText>
  meta: Meta
  screenshots: Shot[]
  listed: boolean
  indexed: boolean
}

interface MediaContext {
  folder: string
  file: string
  sent: ConfigMedia[]
  stored: Map<string, StoredMedia>
  missing: Set<string>
  issues: ConfigIssue[]
}

function resolve(context: MediaContext, entry: string, key: string) {
  const path = joinConfigPath(context.folder, entry)
  const sent = context.sent.find((media) => media.path === path)
  if (!sent) {
    context.issues.push({
      file: context.file,
      key,
      message: `${entry} wasn't sent; is it in the listing folder?`,
    })
    return undefined
  }
  const stored = context.stored.get(sent.sha256)
  if (!stored) context.missing.add(sent.sha256)
  return stored
}

function iconKey(context: MediaContext, entry: string | undefined) {
  if (!entry) return null
  const icon = resolve(context, entry, "icon")
  if (icon && icon.width !== icon.height)
    context.issues.push({ file: context.file, key: "icon", message: `${entry} isn't square` })
  return icon?.key ?? null
}

function screenshotsOf(context: MediaContext, entries: ListingToml["screenshots"]): Shot[] {
  const shots: Shot[] = []
  for (const [position, entry] of (entries ?? []).entries()) {
    const { file, caption, platform } = screenshotFile(entry)
    const key = `screenshots.${position}`
    const shot = resolve(context, file, key)
    if (!shot) continue
    if (shot.svg)
      context.issues.push({ file: context.file, key, message: `${file}: screenshots are PNG, JPEG or WebP` })
    else if (Math.min(shot.width, shot.height) < MIN_SCREENSHOT_EDGE)
      context.issues.push({
        file: context.file,
        key,
        message: `${file} is ${shot.width}×${shot.height}; screenshots are at least ${MIN_SCREENSHOT_EDGE} pixels on each side`,
      })
    shots.push({
      key: shot.key,
      width: shot.width,
      height: shot.height,
      position,
      caption: caption ?? null,
      platform: platform ?? null,
    })
  }
  return shots
}

export function desiredListing(listing: ListingToml, context: MediaContext): DesiredListing {
  const english: ListingText = {
    name: listing.name,
    summary: listing.summary,
    description: listing.description ?? "",
    keywords: listing.keywords ?? [],
  }
  const locales = new Map([[DEFAULT_LOCALE, english]])
  for (const [locale, words] of Object.entries(listing.translations ?? {}))
    locales.set(locale, {
      name: words.name ?? english.name,
      summary: words.summary ?? english.summary,
      description: words.description ?? english.description,
      keywords: words.keywords ?? english.keywords,
    })
  return {
    file: context.file,
    locales,
    meta: {
      iconKey: iconKey(context, listing.icon),
      categories: listing.categories ?? [],
      homepage: listing.homepage ?? null,
      support: listing.support ?? null,
      privacyUrl: listing.privacy_url ?? null,
      contentRating: listing.content_rating ?? null,
      brandColor: listing.brand_color ?? null,
    },
    screenshots: screenshotsOf(context, listing.screenshots),
    listed: listing.listed ?? false,
    indexed: listing.indexed ?? false,
  }
}

const META_KEYS: Record<keyof Meta, string> = {
  iconKey: "icon",
  categories: "categories",
  homepage: "homepage",
  support: "support",
  privacyUrl: "privacy_url",
  contentRating: "content_rating",
  brandColor: "brand_color",
}

const same = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

export async function listingChanges(app: AppRow, desired: DesiredListing): Promise<ConfigChange[]> {
  const [rows, meta, shots] = await Promise.all([
    db.select().from(schema.listing).where(eq(schema.listing.appId, app.id)),
    db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, app.id) }),
    db
      .select()
      .from(schema.screenshot)
      .where(eq(schema.screenshot.appId, app.id))
      .orderBy(schema.screenshot.position),
  ])
  const changes: ConfigChange[] = []
  const change = (key: string, text: string) => changes.push({ file: desired.file, key, change: text })
  for (const [locale, words] of desired.locales) {
    const current = rows.find((row) => row.locale === locale)
    const prefix = locale === DEFAULT_LOCALE ? "" : `translations.${locale}.`
    if (!current) change(prefix || "name", locale === DEFAULT_LOCALE ? "set" : "added")
    else
      for (const field of ["name", "summary", "description", "keywords"] as const)
        if (!same(current[field], words[field])) change(`${prefix}${field}`, "changed")
  }
  for (const row of rows)
    if (!desired.locales.has(row.locale)) change(`translations.${row.locale}`, "removed")
  for (const [field, key] of Object.entries(META_KEYS) as [keyof Meta, string][])
    if (!same(meta?.[field], desired.meta[field]))
      change(key, desired.meta[field] === null || same(desired.meta[field], []) ? "cleared" : "changed")
  const shotKey = (shot: Shot) => [shot.key, shot.caption, shot.platform]
  if (!same(shots.map(shotKey), desired.screenshots.map(shotKey)))
    change("screenshots", `${desired.screenshots.length} in this order`)
  return changes
}

export function listingWrites(app: AppRow, desired: DesiredListing) {
  const locales = [...desired.locales.keys()]
  return [
    db.delete(schema.listing).where(eq(schema.listing.appId, app.id)),
    db
      .insert(schema.listing)
      .values(locales.map((locale) => ({ appId: app.id, locale, ...desired.locales.get(locale)! }))),
    db
      .insert(schema.listingMeta)
      .values({ appId: app.id, ...desired.meta })
      .onConflictDoUpdate({ target: schema.listingMeta.appId, set: desired.meta }),
    db.delete(schema.screenshot).where(eq(schema.screenshot.appId, app.id)),
    ...desired.screenshots.map((shot) =>
      db.insert(schema.screenshot).values({ id: randomId(), appId: app.id, ...shot }),
    ),
  ]
}
