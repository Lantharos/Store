import type { AppSettings } from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { json, person } from "./fixtures.ts"

async function publisherWithNamespace(prefix: string) {
  const owner = await person("Mira")
  const publisherId = randomId()
  const suffix = randomId(6)
  const now = new Date()
  await db.batch([
    db.insert(schema.publisher).values({
      id: publisherId,
      ownerId: owner.id,
      name: `Mira ${suffix}`,
      slug: `mira-${suffix}`,
      kind: "person",
      agreementVersion: "2026-11",
      agreementAt: now,
    }),
    db.insert(schema.member).values({ publisherId, userId: owner.id, role: "owner" }),
    db
      .insert(schema.namespace)
      .values({ prefix, publisherId, proof: "dns", proofValue: "x", verifiedAt: now, checkedAt: now }),
  ])
  return { owner, publisherId }
}

const project = (id: string) => ({
  id,
  name: "Raffi",
  slug: "raffi",
  distribution: "open",
  updater: "electron",
})

describe("a hosted project's id", () => {
  test("can be a reverse-DNS id under a proven namespace, and still ships files", async () => {
    const prefix = `al.example${randomId(6)}`
    const { owner, publisherId } = await publisherWithNamespace(prefix)
    const created = await json<AppSettings>(
      await owner.call("POST", `/publishers/${publisherId}/apps/projects`, project(`${prefix}.raffi`)),
    )
    expect(created.app).toMatchObject({
      id: `${prefix}.raffi`,
      slug: "raffi",
      format: "files",
      updater: "electron",
      visibility: "unlisted",
    })
  })

  test("needs the namespace to be proven", async () => {
    const { owner, publisherId } = await publisherWithNamespace(`al.example${randomId(6)}`)
    const response = await owner.call(
      "POST",
      `/publishers/${publisherId}/apps/projects`,
      project(`com.unproven${randomId(6)}.raffi`),
    )
    expect(response.status).toBe(403)
  })
})
