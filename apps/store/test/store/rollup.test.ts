import { eq } from "drizzle-orm"
import { describe, expect, test, vi } from "vitest"
import { db, schema } from "../../src/db/client.ts"
import { countDay } from "../../src/downloads/rollup.ts"
import { randomId } from "../../src/lib/ids.ts"

function analytics(rows: { version: string; kind: string; source?: string; count: number }[], app: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ data: rows.map((row) => ({ app, platform: "linux-x86_64", ...row })) }),
    )
}

describe("the nightly rollup", () => {
  test("keeps each app's all-time installs, recounted days included", async () => {
    const app = `com.example${randomId(6)}.Notes`
    const total = async () =>
      (await db.query.countTotal.findFirst({ where: eq(schema.countTotal.appId, app) }))?.installs

    analytics([{ version: "1.0.0", kind: "install", count: 4 }], app)
    await countDay("2026-11-01")
    analytics(
      [
        { version: "1.0.0", kind: "install", count: 2 },
        { version: "1.1.0", kind: "update", count: 9 },
      ],
      app,
    )
    await countDay("2026-11-02")
    expect(await total()).toBe(6)

    analytics([{ version: "1.0.0", kind: "install", count: 3 }], app)
    await countDay("2026-11-02")
    expect(await total()).toBe(7)
  })

  test("keeps installs through Schelf apart from other downloads", async () => {
    const app = `com.example${randomId(6)}.Notes`
    analytics(
      [
        { version: "1.0.0", kind: "install", source: "app", count: 5 },
        { version: "1.0.0", kind: "install", source: "cli", count: 2 },
        { version: "1.0.0", kind: "install", source: "", count: 3 },
      ],
      app,
    )
    await countDay("2026-11-03")
    const rows = await db.query.countDaily.findMany({ where: eq(schema.countDaily.appId, app) })
    expect(Object.fromEntries(rows.map((row) => [row.source, row.installs]))).toEqual({
      app: 5,
      cli: 2,
      other: 3,
    })
    expect((await db.query.countTotal.findFirst({ where: eq(schema.countTotal.appId, app) }))?.installs).toBe(
      10,
    )
  })
})
