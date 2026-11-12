import { env, exports } from "cloudflare:workers"
import { type ApiError, type ApplyResponse, sha256Hex } from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { person, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"

function call(token: string, path: string, init: RequestInit) {
  return exports.default.fetch(
    new Request(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...init.headers },
    }),
  )
}

function fakePng(width: number, height: number, seed: number) {
  const bytes = new Uint8Array(40)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[39] = seed
  return bytes
}

const schelf = (appId: string, extra = "") =>
  `id = "${appId}"\nformat = "appimage"\nlisting = "store"\n${extra}`

async function apply(token: string, body: object) {
  return call(token, "/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("applying the files", () => {
  test("the listing file wins over the dashboard, and the dashboard can't change it afterwards", async () => {
    const { appId, token, userId } = await publisherWithApp()
    await env.DB.prepare("UPDATE listing SET summary = 'Typed in the dashboard' WHERE app_id = ?")
      .bind(appId)
      .run()
    const response = await apply(token, {
      schelf_toml: schelf(appId, "[channels.nightly]\nkeep = 3\n"),
      listing_toml:
        'name = "Notes"\nsummary = "From the repository"\ncategories = ["Office"]\n[translations.de]\nsummary = "Aus dem Repository"\n',
    })
    expect(response.status).toBe(200)
    const result = (await response.json()) as ApplyResponse
    expect(result.applied).toBe(true)
    const rows = await env.DB.prepare(
      "SELECT locale, name, summary FROM listing WHERE app_id = ? ORDER BY locale",
    )
      .bind(appId)
      .all<{ locale: string; name: string; summary: string }>()
    expect(rows.results).toEqual([
      { locale: "de", name: "Notes", summary: "Aus dem Repository" },
      { locale: "en", name: "Notes", summary: "From the repository" },
    ])
    const channel = await env.DB.prepare("SELECT keep FROM channel WHERE app_id = ? AND name = 'nightly'")
      .bind(appId)
      .first<{ keep: number }>()
    expect(channel?.keep).toBe(3)
    const owner = await person("Mira", userId)
    const edit = await owner.call("PUT", `/apps/${appId}/listing/en`, {
      name: "Notes",
      summary: "Typed in the dashboard again",
      description: "",
      keywords: [],
    })
    expect(edit.status).toBe(409)
  })

  test("a mistake in a file is refused with the file, the key and what's allowed", async () => {
    const { appId, token } = await publisherWithApp()
    const response = await apply(token, {
      schelf_toml: schelf(appId, 'distribution = "closed"\n'),
      listing_toml: 'name = "Notes"\nsummary = "x"\n',
    })
    expect(response.status).toBe(422)
    const { config } = (await response.json()) as ApiError
    expect(config).toEqual([
      expect.objectContaining({ file: "schelf.toml", key: "distribution", allowed: ["open", "proprietary"] }),
    ])
  })

  test("images it doesn't have yet are asked for, and once sent the screenshots go in the file's order", async () => {
    const { appId, token } = await publisherWithApp()
    const shots = [fakePng(1280, 800, 1), fakePng(1280, 800, 2)]
    const media = await Promise.all(
      shots.map(async (bytes, index) => ({
        path: `store/${index}.png`,
        sha256: await sha256Hex(bytes),
        size: bytes.length,
      })),
    )
    const body = {
      schelf_toml: schelf(appId),
      listing_toml: 'name = "Notes"\nsummary = "Notes"\nscreenshots = ["1.png", "0.png"]\n',
      media,
    }
    const first = (await (await apply(token, body)).json()) as ApplyResponse
    expect(first.applied).toBe(false)
    expect(first.missing_media.sort()).toEqual(media.map((entry) => entry.sha256).sort())
    for (const [index, bytes] of shots.entries()) {
      const sent = await call(token, `/apply/media/${media[index]!.sha256}?app=${appId}`, {
        method: "PUT",
        headers: { "content-length": String(bytes.length) },
        body: bytes,
      })
      expect(sent.status).toBe(201)
    }
    const second = (await (await apply(token, body)).json()) as ApplyResponse
    expect(second.applied).toBe(true)
    const order = await env.DB.prepare("SELECT key FROM screenshot WHERE app_id = ? ORDER BY position")
      .bind(appId)
      .all<{ key: string }>()
    expect(order.results.map((row) => row.key)).toEqual([
      `media/${appId}/${media[1]!.sha256}.png`,
      `media/${appId}/${media[0]!.sha256}.png`,
    ])
  })
})
