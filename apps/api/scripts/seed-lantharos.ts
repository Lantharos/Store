import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type ListingFile, paths, rasterIcon, readListingFile, sha256Hex, slugFromId } from "@schelf/protocol"
import { iconPng } from "../src/dashboard/apps/icon-png.ts"
import { sniffImage } from "../src/dashboard/apps/images.ts"
import { RESIGN_REQUEST } from "../src/signing/resign-request.ts"

const LUFT = process.env.LUFT ?? join(import.meta.dirname, "../../../../luft")
const D1_DATABASE = "a461f2c7-c13f-40bb-a9f7-23b32fb81181"
const OWNER_EMAIL = process.env.OWNER_EMAIL
const REMOTE = process.argv.includes("--remote")
const WORK = join(import.meta.dirname, "../.wrangler")

const PUBLISHER = { id: "lantharos", userId: "lantharos-owner", name: "Lantharos", slug: "lantharos" }
const REPOSITORY = { name: "Lantharos/Luft", id: "1250156825", ownerId: "211589416" }
const PIPELINE = { workflow: ".github/workflows/image.yml", ref: "refs/heads/main" }
const FOLDERS = ["apps/store", "extensions"]
const ONLY = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length)

interface StoreListing extends ListingFile {
  summary: string
  description: string
  categories: string[]
  screenshots: string[]
}

function storeItems() {
  return FOLDERS.flatMap((parent) =>
    readdirSync(join(LUFT, parent))
      .map((name) => `${parent}/${name}`)
      .filter((folder) => existsSync(join(LUFT, folder, "schelf.toml")) && (!ONLY || folder === ONLY)),
  )
}

function readStoreListing(folder: string) {
  const path = join(LUFT, folder, "store/listing.toml")
  if (!existsSync(path)) throw new Error(`${folder} has a schelf.toml but no store/listing.toml`)
  const text = readFileSync(path, "utf8")
  const listing = { ...(Bun.TOML.parse(text) as StoreListing), ...readListingFile(text) }
  return { ...listing, screenshots: listing.screenshots.map((file) => `${folder}/store/${file}`) }
}

function fromListingFile(listing: StoreListing, fields: (keyof StoreListing)[]) {
  return JSON.stringify(
    Object.fromEntries(
      fields.filter((field) => listing[field] !== undefined).map((field) => [field, "listing"]),
    ),
  )
}

function sql(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

function listFrom(text: string, name: string) {
  return [
    ...(new RegExp(`^${name} = \\[([^\\]]*)\\]`, "m").exec(text)?.[1] ?? "").matchAll(/"([^"]+)"/g),
  ].map((match) => match[1]!)
}

function readManifest(folder: string) {
  const sabine = join(LUFT, folder, "Sabine.toml")
  const extension = !existsSync(sabine)
  const text = readFileSync(extension ? join(LUFT, folder, "extension.toml") : sabine, "utf8")
  const field = (name: string) => new RegExp(`^${name} = "([^"]+)"`, "m").exec(text)?.[1]
  return {
    id: field("id")!,
    name: field("name")!,
    kind: extension ? "extension" : "app",
    format: extension ? "luft-extension" : "sabine",
    icon: `${folder}/${extension ? "icon.svg" : field("icon")}`,
    keywords: listFrom(text, "keywords"),
  }
}

async function media(appId: string, file: string, uploads: Map<string, string>) {
  const bytes = new Uint8Array(readFileSync(join(LUFT, file)))
  const image = sniffImage(bytes, true)
  if (!image) throw new Error(`${file} isn't an image the store takes`)
  const key = paths.media(appId, await sha256Hex(bytes), image.extension)
  uploads.set(key, join(LUFT, file))
  return { key, image, bytes }
}

async function iconWithPng(appId: string, file: string, uploads: Map<string, string>) {
  const icon = await media(appId, file, uploads)
  const png = join(WORK, `${icon.key.replaceAll("/", "-")}.png`)
  writeFileSync(png, await iconPng(icon.bytes))
  uploads.set(rasterIcon(icon.key), png)
  return icon
}

async function cf(...args: string[]) {
  const process = Bun.spawn(["bunx", "cf", ...args, ...(REMOTE ? [] : ["--local"])], {
    cwd: join(import.meta.dirname, ".."),
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await process.exited) !== 0) throw new Error(`cf ${args.join(" ")} failed`)
}

if (!OWNER_EMAIL) throw new Error("Set OWNER_EMAIL to the account that should own Lantharos's apps")
const now = Date.now()
const uploads = new Map<string, string>()
const statements = [
  `INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (${sql(PUBLISHER.userId)}, 'Lantharos', ${sql(OWNER_EMAIL)}, 1, ${now}, ${now}) ON CONFLICT (id) DO UPDATE SET email = excluded.email;`,
  `INSERT INTO publisher (id, owner_id, name, slug, kind, agreement_version, agreement_at, status, verified_at, created_at)
   SELECT ${sql(PUBLISHER.id)}, id, ${sql(PUBLISHER.name)}, ${sql(PUBLISHER.slug)}, 'organisation', '2026-11', ${now}, 'active', ${now}, ${now} FROM user WHERE email = ${sql(OWNER_EMAIL)}
   ON CONFLICT (id) DO UPDATE SET name = excluded.name;`,
  `INSERT INTO member (publisher_id, user_id, role, created_at) SELECT ${sql(PUBLISHER.id)}, id, 'owner', ${now} FROM user WHERE email = ${sql(OWNER_EMAIL)}
   ON CONFLICT DO NOTHING;`,
  `INSERT INTO namespace (prefix, publisher_id, proof, proof_value, verified_at, checked_at, created_at) VALUES ('com.lantharos', ${sql(PUBLISHER.id)}, 'manual', '', ${now}, ${now}, ${now})
   ON CONFLICT (prefix) DO UPDATE SET publisher_id = excluded.publisher_id, proof = 'manual', verified_at = excluded.verified_at;`,
]

const folders = storeItems()
for (const folder of folders) {
  const manifest = readManifest(folder)
  const listing = readStoreListing(folder)
  const icon = await iconWithPng(manifest.id, manifest.icon, uploads)
  const keywords = (listing.keywords ?? manifest.keywords).slice(0, 20)
  const wordSources = fromListingFile(listing, ["summary", "description", "keywords"])
  const metaSources = fromListingFile(listing, [
    "categories",
    "homepage",
    "support",
    "privacy_url",
    "brand_color",
  ])
  statements.push(
    `INSERT INTO app (id, slug, publisher_id, kind, format, updater, repository, repository_id, licence, distribution, status, created_at) VALUES (${sql(manifest.id)}, ${sql(slugFromId(manifest.id))}, ${sql(PUBLISHER.id)}, ${sql(manifest.kind)}, ${sql(manifest.format)}, ${manifest.format === "sabine" ? "'sabine'" : "NULL"}, ${sql(REPOSITORY.name)}, ${sql(REPOSITORY.id)}, 'GPL-3.0-or-later', 'open', 'published', ${now})
     ON CONFLICT (id) DO UPDATE SET status = 'published', repository = excluded.repository;`,
    `DELETE FROM trusted_publisher WHERE app_id = ${sql(manifest.id)} AND repository_id = ${sql(REPOSITORY.id)};`,
    `INSERT INTO trusted_publisher (id, app_id, owner_id, repository_id, repository, workflow, environment, ref, created_at) VALUES (${sql(`${manifest.id}:luft`)}, ${sql(manifest.id)}, ${sql(REPOSITORY.ownerId)}, ${sql(REPOSITORY.id)}, ${sql(REPOSITORY.name)}, ${sql(PIPELINE.workflow)}, NULL, ${sql(PIPELINE.ref)}, ${now});`,
    `INSERT INTO listing (app_id, locale, name, summary, description, keywords, sources) VALUES (${sql(manifest.id)}, 'en', ${sql(manifest.name)}, ${sql(listing.summary)}, ${sql(listing.description)}, ${sql(JSON.stringify(keywords))}, ${sql(wordSources)})
     ON CONFLICT (app_id, locale) DO UPDATE SET name = excluded.name, summary = excluded.summary, description = excluded.description, keywords = excluded.keywords, sources = excluded.sources;`,
    `INSERT INTO listing_meta (app_id, icon_key, categories, homepage, support, privacy_url, brand_color, sources) VALUES (${sql(manifest.id)}, ${sql(icon.key)}, ${sql(JSON.stringify(listing.categories))}, ${sql(listing.homepage)}, ${sql(listing.support)}, ${sql(listing.privacy_url)}, ${sql(listing.brand_color)}, ${sql(metaSources)})
     ON CONFLICT (app_id) DO UPDATE SET icon_key = excluded.icon_key, categories = excluded.categories, homepage = excluded.homepage, support = excluded.support, privacy_url = excluded.privacy_url, brand_color = excluded.brand_color, sources = excluded.sources;`,
    `DELETE FROM screenshot WHERE app_id = ${sql(manifest.id)};`,
    `DELETE FROM search WHERE key = ${sql(`schelf:${manifest.id}`)};`,
    `INSERT INTO search (key, name, summary, keywords, developer) VALUES (${sql(`schelf:${manifest.id}`)}, ${sql(manifest.name)}, ${sql(listing.summary)}, ${sql(keywords.join(" "))}, ${sql(PUBLISHER.name)});`,
  )
  for (const [position, file] of listing.screenshots.entries()) {
    const shot = await media(manifest.id, file, uploads)
    statements.push(
      `INSERT INTO screenshot (id, app_id, platform, position, key, width, height, caption) VALUES (${sql(`${manifest.id}-${position}`)}, ${sql(manifest.id)}, NULL, ${position}, ${sql(shot.key)}, ${shot.image.width}, ${shot.image.height}, NULL);`,
    )
  }
}

statements.push(
  `INSERT INTO store_state (key, value) VALUES (${sql(RESIGN_REQUEST)}, ${sql(String(now))}) ON CONFLICT (key) DO UPDATE SET value = excluded.value;`,
)

const batchFile = join(WORK, "seed-lantharos.json")
writeFileSync(batchFile, JSON.stringify(statements.map((statement) => ({ sql: statement }))))
await cf("d1", "query", D1_DATABASE, "--batch", `@${batchFile}`)
for (const [key, file] of uploads) {
  const type = key.endsWith(".svg") ? "image/svg+xml" : key.endsWith(".png") ? "image/png" : "image/webp"
  await cf(
    "r2",
    "objects",
    "put",
    key,
    "--bucket-name",
    "schelf-store",
    "--file",
    file,
    "--content-type",
    type,
  )
}

console.log(`Seeded ${folders.length} apps and extensions; the store signs them on its next hourly run`)
