import { env } from "cloudflare:workers"
import { db, schema } from "../db/client.ts"
import { DAY_MS, dayOf } from "../lib/time.ts"
import { resign } from "../signing/queue.ts"

const DATASET = "schelf_downloads"
const DAYS_RECOUNTED = 2

interface Row {
  app: string
  version: string
  platform: string
  kind: "install" | "update"
  count: number
}

async function query(sql: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.ANALYTICS_TOKEN}` },
      body: sql,
    },
  )
  if (!response.ok) throw new Error(`Analytics Engine answered ${response.status}: ${await response.text()}`)
  return ((await response.json()) as { data: Row[] }).data
}

export async function countDay(day: string) {
  const next = dayOf(new Date(new Date(`${day}T00:00:00Z`).getTime() + DAY_MS))
  const rows = await query(
    `SELECT blob1 AS app, blob2 AS version, blob3 AS platform, blob4 AS kind, SUM(_sample_interval) AS count
     FROM ${DATASET}
     WHERE timestamp >= toDateTime('${day} 00:00:00') AND timestamp < toDateTime('${next} 00:00:00')
     GROUP BY app, version, platform, kind
     FORMAT JSON`,
  )
  const totals = new Map<string, typeof schema.countDaily.$inferInsert>()
  for (const row of rows) {
    const key = `${row.app}\n${row.version}\n${row.platform}`
    const entry = totals.get(key) ?? {
      appId: row.app,
      version: row.version,
      platform: row.platform,
      day,
      installs: 0,
      updates: 0,
    }
    if (row.kind === "update") entry.updates += Number(row.count)
    else entry.installs += Number(row.count)
    totals.set(key, entry)
  }
  const statements = [...totals.values()].map((entry) =>
    db
      .insert(schema.countDaily)
      .values(entry)
      .onConflictDoUpdate({
        target: [
          schema.countDaily.appId,
          schema.countDaily.version,
          schema.countDaily.platform,
          schema.countDaily.day,
        ],
        set: { installs: entry.installs, updates: entry.updates },
      }),
  )
  if (statements.length) await db.batch(statements as never)
  return statements.length
}

export async function rollUpDownloads(now = new Date()) {
  if (!env.ANALYTICS_TOKEN) {
    console.warn("No ANALYTICS_TOKEN, so downloads aren't rolled up")
    return
  }
  for (let back = DAYS_RECOUNTED; back >= 1; back--)
    await countDay(dayOf(new Date(now.getTime() - back * DAY_MS)))
  await resign({ type: "catalog" })
}
