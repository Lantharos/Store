import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { lookalikes } from "../src/publishing/lookalikes.ts"
import { type QuickCheckInput, quickChecks } from "../src/publishing/quick-checks.ts"
import { indexStatements } from "../src/storefront/search-index.ts"
import { publisherWithApp } from "./fixtures.ts"

const impersonation = (lookalike: { id: string; name: string }[], accepted: string[]) =>
  quickChecks({
    app: { id: "com.example.Tailor", kind: "app", visibility: "unlisted" },
    release: { version: "1.0.8", format: "files", requires: {}, permissions: null },
    previous: null,
    artifacts: [],
    attestations: new Map(),
    namespaces: [],
    listing: [{ locale: "en", name: "Tailor", summary: "Tailor", description: "" }],
    meta: null,
    screenshots: 0,
    lookalikes: lookalike,
    acceptedLookalikes: new Set(accepted),
  } as unknown as QuickCheckInput).find((check) => check.name === "impersonation")!

describe("names like another app's", () => {
  const altlinux = { id: "org.altlinux.Tailor", name: "Tailor" }

  test("pass once a reviewer accepted that likeness, and flag a new one", () => {
    expect(impersonation([altlinux], [])).toMatchObject({ status: "warning" })
    expect(impersonation([altlinux], [altlinux.id])).toMatchObject({
      status: "passed",
      summary: "Close to Tailor (org.altlinux.Tailor), which a reviewer accepted with an earlier release",
    })
    expect(
      impersonation([altlinux, { id: "io.github.x.Taylor", name: "Taylor" }], [altlinux.id]),
    ).toMatchObject({
      status: "warning",
    })
  })

  test("leave out the publisher's own apps, whatever the case of their id", async () => {
    const { appId, publisherId } = await publisherWithApp()
    const other = `${appId.slice(0, appId.lastIndexOf("."))}.Ledger${randomId(3)}`
    await db
      .insert(schema.app)
      .values({ id: other, slug: "ledger", publisherId, kind: "app", format: "appimage" })
    const name = `Quill${randomId(4)}`
    await env.DB.batch(
      indexStatements([
        { key: `schelf:${other.toUpperCase()}`, name, summary: "", keywords: [], publisher: "Mira" },
        { key: "flathub:org.example.Quill", name, summary: "", keywords: [], publisher: "Someone" },
      ]),
    )
    const app = (await db.query.app.findFirst({ where: eq(schema.app.id, appId) }))!
    expect((await lookalikes(app, name)).map((hit) => hit.id)).toEqual(["org.example.Quill"])
  })
})
