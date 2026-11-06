import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, test, vi } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { restartStalledChecks } from "../src/releases/checks.ts"
import { publisherWithApp } from "./fixtures.ts"

const HOUR = 3_600_000
const NOW = new Date("2026-11-06T12:00:00Z")

async function checkingRelease(hoursAgo: number) {
  const { appId } = await publisherWithApp()
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version: "1.0.0",
    origin: "oidc",
    format: "appimage",
    manifest: "",
    requires: {},
    status: "checking",
    createdAt: new Date(NOW.getTime() - hoursAgo * HOUR),
  })
  return id
}

async function dispatchesDuring(work: () => Promise<void>) {
  const dispatched: string[] = []
  env.GITHUB_TOKEN = "token"
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    dispatched.push(JSON.parse(init.body as string).client_payload.release)
    return new Response(null, { status: 204 })
  })
  await work()
  return dispatched
}

const statusOf = async (id: string) =>
  (await db.query.release.findFirst({ where: eq(schema.release.id, id) }))!.status

afterEach(() => {
  vi.unstubAllGlobals()
  env.GITHUB_TOKEN = ""
})

describe("stalled checks", () => {
  test("run again once they're past the workflow's time limit", async () => {
    const running = await checkingRelease(1)
    const stalled = await checkingRelease(8)
    const dispatched = await dispatchesDuring(() => restartStalledChecks(NOW))
    expect(dispatched).toContain(stalled)
    expect(dispatched).not.toContain(running)
    expect(await statusOf(stalled)).toBe("checking")
  })

  test("fail the release after a day instead of letting it through", async () => {
    const abandoned = await checkingRelease(25)
    const dispatched = await dispatchesDuring(() => restartStalledChecks(NOW))
    expect(dispatched).not.toContain(abandoned)
    expect(await statusOf(abandoned)).toBe("failed")
  })
})
