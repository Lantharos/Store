import { exports } from "cloudflare:workers"
import { type ApplyResponse, paths } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test, vi } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { domainState } from "../src/domains/state.ts"
import { randomId } from "../src/lib/ids.ts"
import { publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"

async function apply(token: string, appId: string, domain: string) {
  const dns = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}))
  const response = await exports.default.fetch(
    new Request(`${API}/apply`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ schelf_toml: `id = "${appId}"\nformat = "files"\ndomain = "${domain}"\n` }),
    }),
  )
  dns.mockRestore()
  return response
}

async function shipped(appId: string) {
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version: "1.0.0",
    origin: "oidc",
    format: "files",
    manifest: "",
    requires: {},
    status: "live",
    rolloutPercent: 100,
    approvedAt: new Date(),
  })
  await db.insert(schema.artifact).values({
    id: randomId(),
    releaseId: id,
    name: "notes.exe",
    platform: "windows-x86_64",
    format: "files",
    kind: "exe",
    key: paths.artifact(appId, "1.0.0", "windows-x86_64", "notes.exe"),
    size: 10,
    sha256: "b".repeat(64),
  })
}

describe("a custom domain", () => {
  test("waits for its DNS proof, then serves the project's links", async () => {
    const { appId, token } = await publisherWithApp("files")
    await db
      .update(schema.app)
      .set({ status: "published", visibility: "unlisted" })
      .where(eq(schema.app.id, appId))
    await shipped(appId)
    const domain = `downloads-${randomId(4).toLowerCase()}.example.com`
    const result = (await (await apply(token, appId, domain)).json()) as ApplyResponse
    expect(result.changes.map((change) => change.key)).toContain("domain")

    const row = (await db.query.customDomain.findFirst({ where: eq(schema.customDomain.appId, appId) }))!
    const state = domainState(row)
    expect(state.status).toBe("proving")
    expect(state.records.map((record) => record.name)).toEqual([`_schelf.${domain}`, domain])

    await db
      .update(schema.customDomain)
      .set({ provenAt: new Date(), activeAt: new Date() })
      .where(eq(schema.customDomain.domain, domain))
    const link = await exports.default.fetch(
      new Request(`https://${domain}/latest/windows`, { redirect: "manual" }),
    )
    expect(link.status).toBe(302)
    expect(link.headers.get("location")).toContain("notes.exe")
  })

  test("serves one project only, and nothing before it's connected", async () => {
    const first = await publisherWithApp("files")
    const second = await publisherWithApp("files")
    const domain = `shared-${randomId(4).toLowerCase()}.example.com`
    await apply(first.token, first.appId, domain)
    expect((await apply(second.token, second.appId, domain)).status).toBe(409)
    expect((await exports.default.fetch(`https://${domain}/latest/windows`)).status).toBe(404)
  })
})
