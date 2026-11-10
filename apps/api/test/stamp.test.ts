import { env } from "cloudflare:workers"
import { paths, revocations, SIGNED_FOR_DAYS } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { DAY_MS } from "../src/lib/time.ts"
import { rebuildRevocations } from "../src/signing/rebuild.ts"

async function signedRevocations() {
  await rebuildRevocations()
  return revocations.parse(await (await env.BUCKET.get(paths.revocations))!.json())
}

describe("signed documents", () => {
  test("say when they stop counting and never go back to an older serial", async () => {
    const first = await signedRevocations()
    const second = await signedRevocations()
    expect(second.serial).toBeGreaterThan(first.serial)
    const lasts = new Date(second.expires).getTime() - Date.now()
    expect(lasts).toBeGreaterThan((SIGNED_FOR_DAYS - 1) * DAY_MS)
    expect(lasts).toBeLessThanOrEqual(SIGNED_FOR_DAYS * DAY_MS)

    const ahead = Date.now() + DAY_MS
    await db
      .update(schema.storeState)
      .set({ value: String(ahead) })
      .where(eq(schema.storeState.key, `serial:${paths.revocations}`))
    expect((await signedRevocations()).serial).toBe(ahead + 1)
  })
})
