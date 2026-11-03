import { and, desc, eq, isNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import { resign } from "../signing/queue.ts"
import { reindexApp } from "../storefront/indexing.ts"
import { notifyDeveloper } from "./notify.ts"

async function resignEverything(appId: string) {
  await Promise.all([
    resign({ type: "app", id: appId }, { type: "catalog" }, { type: "revocations" }),
    reindexApp(appId),
  ])
}

export async function delist(appId: string, listed: boolean) {
  await db
    .update(schema.app)
    .set({ status: listed ? "listed" : "delisted" })
    .where(eq(schema.app.id, appId))
  await resignEverything(appId)
}

export async function pull(target: { app: string; release?: string }, reason: string, note: string) {
  await db.insert(schema.block).values({
    id: randomId(),
    appId: target.app,
    releaseId: target.release ?? null,
    action: "block",
    reason,
    publicNote: note,
  })
  if (target.release)
    await db.update(schema.release).set({ status: "pulled" }).where(eq(schema.release.id, target.release))
  else await db.update(schema.app).set({ status: "pulled" }).where(eq(schema.app.id, target.app))
  await resignEverything(target.app)
  const [latest] = await db
    .select({ id: schema.release.id })
    .from(schema.release)
    .where(eq(schema.release.appId, target.app))
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
  const notified = target.release ?? latest?.id
  if (notified) notifyDeveloper(notified, "pulled", note)
}

export async function unpull(target: { app: string; release?: string }) {
  await db
    .update(schema.block)
    .set({ liftedAt: new Date() })
    .where(
      and(
        eq(schema.block.appId, target.app),
        target.release ? eq(schema.block.releaseId, target.release) : isNull(schema.block.releaseId),
        isNull(schema.block.liftedAt),
      ),
    )
  if (target.release)
    await db.update(schema.release).set({ status: "live" }).where(eq(schema.release.id, target.release))
  else await db.update(schema.app).set({ status: "listed" }).where(eq(schema.app.id, target.app))
  await resignEverything(target.app)
}
