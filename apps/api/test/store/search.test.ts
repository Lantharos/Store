import { env } from "cloudflare:workers"
import { describe, expect, test } from "vitest"
import { db, schema } from "../../src/db/client.ts"
import { reindexIfRequested } from "../../src/storefront/indexing.ts"
import { REINDEX_REQUEST } from "../../src/storefront/reindex-request.ts"
import { indexStatements, searchKeys } from "../../src/storefront/search-index.ts"

const apps = [
  { key: "schelf:com.lantharos.magpie", name: "Magpie", summary: "Photos, videos and music" },
  { key: "schelf:com.lantharos.mailman", name: "Mailman", summary: "Mail" },
  { key: "schelf:com.lantharos.tern", name: "Tern", summary: "Terminal" },
  { key: "flathub:org.gnome.Maps", name: "GNOME Maps", summary: "Find places around the world" },
  { key: "flathub:io.github.dgsasha.Remembrance", name: "Reminders", summary: "Set reminders for yourself" },
  {
    key: "schelf:com.lantharos.Reminders",
    name: "Reminders",
    summary: "Reminders that come back when they should",
  },
  { key: "flathub:io.github.Bollos00.LibreMines", name: "LibreMines", summary: "Minesweeper" },
  { key: "flathub:com.mojang.Minecraft", name: "Minecraft Launcher", summary: "Craft and explore" },
]

describe("search", () => {
  test("finds apps by the start of their name and despite typos", async () => {
    await env.DB.batch(indexStatements(apps.map((app) => ({ ...app, keywords: [], publisher: "Someone" }))))
    const keys = async (query: string) => (await searchKeys(query, 10)).map((hit) => hit.key)
    expect(await keys("ma")).toEqual(
      expect.arrayContaining([
        "schelf:com.lantharos.magpie",
        "schelf:com.lantharos.mailman",
        "flathub:org.gnome.Maps",
      ]),
    )
    expect(await keys("termnal")).toContain("schelf:com.lantharos.tern")
    expect(await keys("termnal")).not.toContain("schelf:com.lantharos.magpie")
    expect((await searchKeys("ma", 10, "schelf")).every((hit) => hit.key.startsWith("schelf:"))).toBe(true)
  })

  test("puts exact names first, the store's own before mirrors, and leaves out loose matches", async () => {
    await env.DB.batch(indexStatements(apps.map((app) => ({ ...app, keywords: [], publisher: "Someone" }))))
    const keys = async (query: string) => (await searchKeys(query, 10)).map((hit) => hit.key)
    expect((await keys("reminders")).slice(0, 2)).toEqual([
      "schelf:com.lantharos.Reminders",
      "flathub:io.github.dgsasha.Remembrance",
    ])
    expect(await keys("reminders")).not.toContain("flathub:io.github.Bollos00.LibreMines")
    expect(await keys("remimders")).toContain("schelf:com.lantharos.Reminders")
    expect(await keys("draft")).not.toContain("flathub:com.mojang.Minecraft")
  })

  test("matches names with or without their accents", async () => {
    await env.DB.batch(
      indexStatements([
        {
          key: "schelf:com.example.Cafe",
          name: "Café Noir",
          summary: "",
          keywords: [],
          publisher: "Someone",
        },
        {
          key: "flathub:org.example.Creme",
          name: "Creme",
          summary: "Desserts",
          keywords: [],
          publisher: "Someone",
        },
      ]),
    )
    const keys = async (query: string) => (await searchKeys(query, 10)).map((hit) => hit.key)
    expect(await keys("cafe")).toContain("schelf:com.example.Cafe")
    expect(await keys("crème")).toContain("flathub:org.example.Creme")
    expect((await searchKeys("noir", 10)).find((hit) => hit.key === "schelf:com.example.Cafe")?.name).toBe(
      "Café Noir",
    )
  })

  test("indexes the mirror again when asked, as after a migration", async () => {
    await db.insert(schema.mirrorApp).values({
      id: "org.example.Pokedex",
      origin: "flathub",
      ref: "app/org.example.Pokedex/x86_64/stable",
      name: "Pokédex Viewer",
      summary: "Look things up",
      categories: [],
      publisher: "Someone",
      verified: false,
      installs30d: 0,
      updatedAt: new Date(),
      rank: 0,
    })
    await db.insert(schema.storeState).values({ key: REINDEX_REQUEST, value: "0" }).onConflictDoNothing()
    await reindexIfRequested()
    expect((await searchKeys("pokedex", 10)).map((hit) => hit.key)).toContain("flathub:org.example.Pokedex")
  })

  test("an app indexed again takes the place of an entry under its id's old case", async () => {
    const name = `Heft${Math.random().toString(36).slice(2, 7)}`
    const entry = (key: string) => ({ key, name, summary: "", keywords: [], publisher: "Someone" })
    await env.DB.batch(indexStatements([entry("schelf:com.example.Ledger")]))
    await env.DB.batch(indexStatements([entry("schelf:com.example.ledger")]))
    expect((await searchKeys(name, 10)).map((hit) => hit.key)).toEqual(["schelf:com.example.ledger"])
  })
})
