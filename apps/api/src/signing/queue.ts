import { env } from "cloudflare:workers"
import { and, eq, inArray } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { rebuildApp, rebuildCatalog, rebuildRevocations } from "./rebuild.ts"
import { RESIGN_REQUEST } from "./resign-request.ts"

const QUEUE_BATCH = 100

export type SigningJob = { type: "app"; id: string } | { type: "catalog" } | { type: "revocations" }

export function resign(...jobs: SigningJob[]) {
  return env.SIGNING.sendBatch(jobs.map((body) => ({ body })))
}

export async function resignEverything() {
  const apps = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(inArray(schema.app.status, ["published", "delisted", "pulled", "deleted"]))
  for (let start = 0; start < apps.length; start += QUEUE_BATCH)
    await resign(
      ...apps.slice(start, start + QUEUE_BATCH).map((app) => ({ type: "app" as const, id: app.id })),
    )
  await resign({ type: "catalog" }, { type: "revocations" })
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

export async function signQueued(batch: MessageBatch<SigningJob>) {
  const apps = new Set<string>()
  let catalog = false
  let revocations = false
  for (const { body } of batch.messages) {
    if (body.type === "app") apps.add(body.id)
    else if (body.type === "catalog") catalog = true
    else revocations = true
  }
  for (const id of apps) await rebuildApp(id)
  if (catalog) await rebuildCatalog()
  if (revocations) await rebuildRevocations()
}
