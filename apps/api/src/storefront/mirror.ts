import { env } from "cloudflare:workers"
import {
  type MirrorEntry,
  type MirrorOrigin,
  type MirrorRequest,
  type MirrorResponse,
  paths,
} from "@schelf/protocol"
import { and, inArray } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { within } from "../signing/records.ts"
import { writeSigned } from "../signing/write.ts"
import { clearOriginStatement, indexStatements } from "./search-index.ts"

const STATEMENTS_PER_BATCH = 400

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
