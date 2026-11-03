import { and, eq, gt } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { DAY_MS } from "../lib/time.ts"

const NEW_PUBLISHER_DAYS = 30
const NEW_PUBLISHER_UPLOADS_PER_DAY = 3

export async function limitManualUploads(publisherId: string, now = Date.now()) {
  const publisher = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, publisherId) })
  if (now - publisher!.createdAt.getTime() > NEW_PUBLISHER_DAYS * DAY_MS) return
  const recent = await db
    .select({ id: schema.release.id })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .where(
      and(
        eq(schema.app.publisherId, publisherId),
        eq(schema.release.origin, "manual"),
        gt(schema.release.createdAt, new Date(now - DAY_MS)),
      ),
    )
  if (recent.length >= NEW_PUBLISHER_UPLOADS_PER_DAY)
    fail(
      429,
      `New publishers can upload ${NEW_PUBLISHER_UPLOADS_PER_DAY} releases by hand a day. Publishing from GitHub Actions has no such limit.`,
    )
}
