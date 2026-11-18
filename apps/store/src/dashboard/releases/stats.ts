import { type Platform, type Stats, statsQuery } from "@schelf/protocol"
import { and, eq, gte, sql } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { readQuery } from "../../lib/http.ts"
import { DAY_MS, dayOf } from "../../lib/time.ts"
import { appAccess } from "../../publishers/access.ts"

export const statsRoutes = new Hono<SignedInVars>()

const installs = sql<number>`sum(${schema.countDaily.installs})`
const updates = sql<number>`sum(${schema.countDaily.updates})`

statsRoutes.get("/:id/stats", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"))
  const { days } = readQuery(c, statsQuery)
  const since = and(
    eq(schema.countDaily.appId, app.id),
    gte(schema.countDaily.day, dayOf(new Date(Date.now() - days * DAY_MS))),
  )
  const grouped = (column: SQLiteColumn) =>
    db
      .select({ key: sql<string>`${column}`, installs, updates })
      .from(schema.countDaily)
      .where(since)
      .groupBy(column)
      .orderBy(column)
  const [byDay, byVersion, byPlatform] = await Promise.all([
    grouped(schema.countDaily.day),
    grouped(schema.countDaily.version),
    grouped(schema.countDaily.platform),
  ])
  return c.json({
    days: byDay.map((row) => ({ day: row.key, installs: row.installs, updates: row.updates })),
    versions: byVersion.map((row) => ({ version: row.key, installs: row.installs, updates: row.updates })),
    platforms: byPlatform.map((row) => ({
      platform: row.key as Platform,
      installs: row.installs,
      updates: row.updates,
    })),
    total: {
      installs: byDay.reduce((total, row) => total + row.installs, 0),
      updates: byDay.reduce((total, row) => total + row.updates, 0),
    },
  } satisfies Stats)
})
