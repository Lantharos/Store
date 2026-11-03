import { env } from "cloudflare:workers"
import { describe, expect, test } from "vitest"
import { indexStatements, searchKeys } from "../src/storefront/search-index.ts"

const apps = [
  { key: "schelf:com.lantharos.magpie", name: "Magpie", summary: "Photos, videos and music" },
  { key: "schelf:com.lantharos.mailman", name: "Mailman", summary: "Mail" },
  { key: "schelf:com.lantharos.tern", name: "Tern", summary: "Terminal" },
  { key: "flathub:org.gnome.Maps", name: "GNOME Maps", summary: "Find places around the world" },
]

describe("search", () => {
  test("finds apps by the start of their name and despite typos", async () => {
    await env.DB.batch(indexStatements(apps.map((app) => ({ ...app, keywords: [], developer: "Someone" }))))
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
})
