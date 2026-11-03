import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { stepRollouts } from "../src/releases/rollout.ts"
import { developerWithApp } from "./fixtures.ts"

const HOUR = 3_600_000

async function approvedRelease(percent: number, steppedAt: Date, paused = false) {
  const { appId } = await developerWithApp()
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version: "1.0.0",
    origin: "token",
    manifest: "",
    requires: {},
    status: percent === 100 ? "live" : "rolling-out",
    rolloutPercent: percent,
    rolloutPaused: paused,
    rolloutSteppedAt: steppedAt,
    approvedAt: steppedAt,
  })
  return id
}

async function rolloutOf(id: string) {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, id) })
  return { percent: release!.rolloutPercent, status: release!.status }
}

describe("rollouts", () => {
  test("step 10, 25, 50, 100 once a day and end live", async () => {
    const start = new Date("2026-11-01T00:00:00Z")
    const id = await approvedRelease(10, start)
    await stepRollouts(new Date(start.getTime() + 23 * HOUR))
    expect(await rolloutOf(id)).toEqual({ percent: 10, status: "rolling-out" })
    const seen = []
    for (let day = 1; day <= 4; day++) {
      await stepRollouts(new Date(start.getTime() + day * 24 * HOUR))
      seen.push(await rolloutOf(id))
    }
    expect(seen).toEqual([
      { percent: 25, status: "rolling-out" },
      { percent: 50, status: "rolling-out" },
      { percent: 100, status: "live" },
      { percent: 100, status: "live" },
    ])
  })

  test("a paused rollout stays where it is", async () => {
    const start = new Date("2026-11-01T00:00:00Z")
    const id = await approvedRelease(25, start, true)
    await stepRollouts(new Date(start.getTime() + 72 * HOUR))
    expect(await rolloutOf(id)).toEqual({ percent: 25, status: "rolling-out" })
  })

  test("a percentage set by hand moves on to the next step after it", async () => {
    const start = new Date("2026-11-01T00:00:00Z")
    const id = await approvedRelease(30, start)
    await stepRollouts(new Date(start.getTime() + 24 * HOUR))
    expect(await rolloutOf(id)).toEqual({ percent: 50, status: "rolling-out" })
  })
})
