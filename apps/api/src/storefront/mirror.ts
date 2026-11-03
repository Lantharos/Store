import { env } from "cloudflare:workers"
import {
  MAX_ICON_BYTES,
  MIRROR_ORIGINS,
  type MirrorEntry,
  type MirrorOrigin,
  type MirrorRequest,
  type MirrorResponse,
  paths,
  sha256Hex,
} from "@schelf/protocol"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { fileUrl, within } from "../signing/records.ts"
import { writeSigned } from "../signing/write.ts"
import { clearOriginStatement, indexStatements } from "./search-index.ts"

const STATEMENTS_PER_BATCH = 400
const MIRROR_ID = /^[A-Za-z0-9._+-]{1,255}$/
const ICON_FILE = /^([0-9a-f]{16})\.png$/

function mirrorKey(entry: Pick<MirrorEntry, "origin" | "id">) {
  return `${entry.origin}:${entry.id}`
}

function toEntry(row: typeof schema.mirrorApp.$inferSelect): MirrorEntry {
  const base = {
    id: row.id,
    kind: "app" as const,
    name: row.name,
    summary: row.summary,
    icon: row.icon,
    categories: row.categories,
    developer: { name: row.developer, verified: row.verified },
    updated: row.updatedAt.toISOString(),
    installs_30d: row.installs30d,
    rank: row.rank,
  }
  return row.origin === "flathub"
    ? { ...base, origin: "flathub", flathub: row.ref }
    : { ...base, origin: "fedora", package: row.ref }
}

export async function mirrorHits(keys: string[]) {
  const wanted = keys.filter((key) => !key.startsWith("schelf:"))
  const hits = new Map<string, MirrorEntry>()
  if (!wanted.length) return hits
  const ids = wanted.map((key) => key.slice(key.indexOf(":") + 1))
  const rows = await db
    .select()
    .from(schema.mirrorApp)
    .where(and(within(schema.mirrorApp.id, ids), inArray(schema.mirrorApp.origin, ["flathub", "fedora"])))
  for (const row of rows) if (!row.hiddenReason) hits.set(mirrorKey(row), toEntry(row))
  return hits
}

export async function mirrorEntry(id: string, origin: string | undefined) {
  const rows = await db
    .select()
    .from(schema.mirrorApp)
    .where(and(eq(schema.mirrorApp.id, id), isNull(schema.mirrorApp.hiddenReason)))
  const preferred = origin ? [origin] : MIRROR_ORIGINS
  const row = preferred.map((name) => rows.find((candidate) => candidate.origin === name)).find(Boolean)
  return row ? toEntry(row) : null
}

async function replaceOrigin(origin: MirrorOrigin, entries: MirrorEntry[]) {
  const insert = env.DB.prepare(
    `INSERT INTO mirror_app (id, origin, ref, name, summary, icon, categories, developer, verified, installs_30d, updated_at, hidden_reason, rank)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
  const statements = [
    env.DB.prepare("DELETE FROM mirror_app WHERE origin = ?").bind(origin),
    clearOriginStatement(origin),
    ...entries.map((entry) =>
      insert.bind(
        entry.id,
        origin,
        entry.origin === "flathub" ? entry.flathub : entry.package,
        entry.name,
        entry.summary,
        entry.icon,
        JSON.stringify(entry.categories),
        entry.developer.name,
        entry.developer.verified ? 1 : 0,
        entry.installs_30d,
        new Date(entry.updated).getTime(),
        entry.rank,
      ),
    ),
    ...indexStatements(
      entries.map((entry) => ({
        key: mirrorKey(entry),
        name: entry.name,
        summary: entry.summary,
        keywords: entry.categories,
        developer: entry.developer.name,
      })),
    ),
  ]
  for (let start = 0; start < statements.length; start += STATEMENTS_PER_BATCH)
    await env.DB.batch(statements.slice(start, start + STATEMENTS_PER_BATCH))
  await writeSigned(paths.mirror(origin), {
    version: 1,
    generated: new Date().toISOString(),
    origin,
    apps: [...entries].sort((left, right) => right.rank - left.rank),
  })
}

export async function replaceMirror(request: MirrorRequest): Promise<MirrorResponse> {
  const flathub = request.flathub.filter((entry) => entry.origin === "flathub")
  const fedora = request.fedora.filter((entry) => entry.origin === "fedora")
  await replaceOrigin("flathub", flathub)
  await replaceOrigin("fedora", fedora)
  return { flathub: flathub.length, fedora: fedora.length }
}

export async function receiveMirrorIcon(id: string, file: string, request: Request) {
  const hash = ICON_FILE.exec(file)?.[1]
  if (!MIRROR_ID.test(id) || !hash)
    fail(422, "Mirror icons go to <app id>/<first 16 hex digits of their SHA-256>.png")
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_ICON_BYTES) fail(413, "Icons are at most 1 MB")
  if (!(await sha256Hex(bytes)).startsWith(hash)) fail(422, "The icon doesn't match the hash in its name")
  const key = paths.media(id, hash, "png")
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
  })
  return { url: fileUrl(key) }
}
