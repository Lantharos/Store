import { env } from "cloudflare:workers"
import { MIRROR_ORIGINS, type MirrorOrigin } from "@schelf/protocol"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { rebuildApps, rebuildCatalog, rebuildMirror, rebuildRevocations } from "./rebuild.ts"
import { RESIGN_REQUEST } from "./resign-request.ts"

const QUEUE_BATCH = 100
const CATALOG_DUE = "catalog.due"
const CATALOG_DELAY_SECONDS = 30
const CATALOG_OVERDUE_MS = 10 * 60_000

export type SigningJob =
  | { type: "app"; id: string }
  | { type: "catalog" }
  | { type: "mirror"; origin: MirrorOrigin }
  | { type: "revocations" }

/** Asks for the catalog once for everything that changes in the next half minute, or again if that ask got lost. */
async function queueCatalog() {
  const now = Date.now()
  const [due] = await db
    .insert(schema.storeState)
    .values({ key: CATALOG_DUE, value: String(now) })
    .onConflictDoUpdate({
      target: schema.storeState.key,
      set: { value: String(now) },
      setWhere: sql`cast(${schema.storeState.value} as integer) < ${now - CATALOG_OVERDUE_MS}`,
    })
    .returning()
  if (due) await env.SIGNING.send({ type: "catalog" }, { delaySeconds: CATALOG_DELAY_SECONDS })
}

export async function resign(...jobs: SigningJob[]) {
  const now = jobs.filter((job) => job.type !== "catalog")
  const sends = Array.from({ length: Math.ceil(now.length / QUEUE_BATCH) }, (_, index) =>
    env.SIGNING.sendBatch(
      now.slice(index * QUEUE_BATCH, (index + 1) * QUEUE_BATCH).map((body) => ({ body })),
    ),
  )
  await Promise.all([...sends, now.length < jobs.length && queueCatalog()])
}

export async function resignEverything() {
  const apps = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(inArray(schema.app.status, ["published", "delisted", "pulled", "deleted"]))
  await resign(
    ...apps.map((app) => ({ type: "app" as const, id: app.id })),
    { type: "catalog" },
    ...MIRROR_ORIGINS.map((origin) => ({ type: "mirror" as const, origin })),
    { type: "revocations" },
  )
  return apps.length
}

export async function resignIfRequested() {
  const [request] = await db
    .delete(schema.storeState)
    .where(eq(schema.storeState.key, RESIGN_REQUEST))
    .returning()
  if (request) await resignEverything()
}

export async function resignPublisher(publisherId: string) {
  const apps = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(
      and(
        eq(schema.app.publisherId, publisherId),
        inArray(schema.app.status, ["published", "delisted", "pulled", "deleted"]),
      ),
    )
  if (apps.length)
    await resign(...apps.map((app) => ({ type: "app" as const, id: app.id })), { type: "catalog" })
  return apps.map((app) => app.id)
}

export function resignApp(id: string) {
  return resign({ type: "app", id }, { type: "catalog" })
}

async function catalogWanted(messages: readonly Message<SigningJob>[]) {
  if (!messages.length) return false
  if (messages.some((message) => message.attempts > 1)) return true
  const [due] = await db.delete(schema.storeState).where(eq(schema.storeState.key, CATALOG_DUE)).returning()
  return due !== undefined
}

export async function signQueued(batch: MessageBatch<SigningJob>) {
  const apps = new Set<string>()
  const mirrors = new Set<MirrorOrigin>()
  let revocations = false
  for (const { body } of batch.messages) {
    if (body.type === "app") apps.add(body.id)
    else if (body.type === "mirror") mirrors.add(body.origin)
    else if (body.type === "revocations") revocations = true
  }
  if (apps.size) await rebuildApps([...apps])
  const catalog = await catalogWanted(batch.messages.filter((message) => message.body.type === "catalog"))
  await Promise.all([
    catalog && rebuildCatalog(),
    ...[...mirrors].map(rebuildMirror),
    revocations && rebuildRevocations(),
  ])
}
