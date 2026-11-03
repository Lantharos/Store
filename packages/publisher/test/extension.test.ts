import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  API_BASE,
  type CompleteResponse,
  EXTENSION_MANIFEST,
  type PublishRequest,
  type PublishResponse,
  readExtensionAccess,
  schelfTomlFor,
} from "@schelf/protocol"
import { collectArtifacts, hashArtifacts, publishRelease, releaseContext } from "../src/index.ts"

const RAIN_MANIFEST = `id = "com.lantharos.Rain"
name = "Rain"
description = "Rain falls over the wallpaper and splashes on windows and the taskbar."
version = "1.0.0"
api = 1
permissions = ["wallpaper", "quick-settings"]

[helper]
path = "rain-sound"

[[settings]]
key = "rain"
type = "switch"
label = "rain"
default = false
`

let root: string
let store: ReturnType<typeof Bun.serve>
const received: { publish?: PublishRequest; upload?: Uint8Array; completed: boolean } = { completed: false }

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "schelf-extension-"))
  await writeFile(
    join(root, "schelf.toml"),
    schelfTomlFor({ id: "com.lantharos.Rain", kind: "extension", format: "luft-extension", extensionApi: 1 }),
  )
  await writeFile(join(root, EXTENSION_MANIFEST), RAIN_MANIFEST)
  await writeFile(join(root, "com.lantharos.Rain.tar.zst"), "packed extension")
  store = Bun.serve({
    port: 0,
    routes: {
      [`${API_BASE}/publish`]: {
        POST: async (request) => {
          received.publish = (await request.json()) as PublishRequest
          const file = received.publish.files[0]!
          return Response.json({
            release: "r1",
            app: "com.lantharos.Rain",
            version: "1.0.0",
            channel: "stable",
            status: "uploading",
            dashboard: "",
            upload_token: "upload",
            expires: "",
            files: [
              {
                name: file.name,
                url: `/api/v1/publish/r1/files/${file.name}`,
                parts: 1,
                part_size: file.size,
              },
            ],
          } satisfies PublishResponse)
        },
      },
      [`${API_BASE}/publish/r1/files/:name`]: {
        PUT: async (request) => {
          received.upload = new Uint8Array(await request.arrayBuffer())
          return Response.json({ name: request.params.name, part: null, received: received.upload.length })
        },
      },
      [`${API_BASE}/publish/r1/complete`]: {
        POST: () => {
          received.completed = true
          return Response.json({
            release: "r1",
            status: "checking",
            checks: [],
            dashboard: "",
          } satisfies CompleteResponse)
        },
      },
    },
  })
})

afterAll(async () => {
  await store.stop(true)
  await rm(root, { recursive: true })
})

test("an extension is published with its manifest as the permission declaration", async () => {
  const context = await releaseContext(join(root, "schelf.toml"))
  expect(context.manifest).toMatchObject({ kind: "extension", permissions: EXTENSION_MANIFEST })
  expect(context.permissionsToml).toBe(RAIN_MANIFEST)

  const artifacts = await hashArtifacts(
    await collectArtifacts([join(root, "*.tar.zst")], context.manifest.format),
  )
  await publishRelease({
    api: store.url.origin,
    token: "oidc",
    version: "1.0.0",
    schelfToml: context.schelfToml,
    permissionsToml: context.permissionsToml,
    notes: "",
    artifacts,
  })

  expect(received.publish!.files).toEqual([
    expect.objectContaining({
      name: "com.lantharos.Rain.tar.zst",
      platform: "luft",
      kind: "extension",
      size: 16,
    }),
  ])
  expect(readExtensionAccess(received.publish!.permissions_toml!)).toEqual({
    permissions: ["wallpaper", "quick-settings"],
    helper: true,
  })
  expect(new TextDecoder().decode(received.upload)).toBe("packed extension")
  expect(received.completed).toBe(true)
})
