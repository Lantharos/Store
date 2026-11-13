import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  generateSigningSeed,
  importSigningKey,
  paths,
  type SigningKey,
  sha256Hex,
  signDocument,
} from "@schelf/protocol"
import { schelfProgram } from "../src/index.ts"

const TARGET = "linux-x86_64"
const PROGRAM = new TextEncoder().encode("#!/bin/sh\necho schelf\n")
const DAY_MS = 86_400_000

interface Fixture {
  files: Map<string, string | Uint8Array<ArrayBuffer>>
  requests: string[]
  origin: string
  rootKey: string
  sign: (key: string, document: object, by?: SigningKey) => Promise<void>
  storeKey: SigningKey
  stop: () => void
}

let fixture: Fixture
let folder: string

async function serve(): Promise<Fixture> {
  const files = new Map<string, string | Uint8Array<ArrayBuffer>>()
  const requests: string[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const key = new URL(request.url).pathname.slice(1)
      requests.push(key)
      const file = files.get(key)
      return file === undefined ? new Response("missing", { status: 404 }) : new Response(file)
    },
  })
  const root = await importSigningKey(await generateSigningSeed())
  const storeKey = await importSigningKey(await generateSigningSeed())
  const expires = new Date(Date.now() + DAY_MS).toISOString()
  const sign = async (key: string, document: object, by = storeKey) => {
    const signed = await signDocument(by, { path: key, serial: 1, expires, ...document })
    files.set(key, signed.body)
    files.set(paths.signature(key), signed.signature)
  }
  await sign(
    paths.storeKeys,
    {
      version: 1,
      issued: new Date().toISOString(),
      keys: [
        {
          id: storeKey.id,
          public_key: storeKey.publicKey,
          not_before: new Date(Date.now() - DAY_MS).toISOString(),
          expires,
        },
      ],
      revoked: [],
    },
    root,
  )
  await sign(paths.revocations, { issued: new Date().toISOString(), blocked: [] })
  return {
    files,
    requests,
    origin: `http://localhost:${server.port}`,
    rootKey: root.publicKey,
    sign,
    storeKey,
    stop: () => server.stop(true),
  }
}

async function publish(version: string, program: Uint8Array<ArrayBuffer>, sha256?: string) {
  const file = `apps/lantharos.schelf/${version}/${TARGET}/schelf-${TARGET}`
  fixture.files.set(file, program)
  await fixture.sign(paths.tool("lantharos", "schelf"), {
    version: 1,
    generated: new Date().toISOString(),
    name: "schelf",
    address: "lantharos/schelf",
    short: false,
    project: { id: "lantharos.schelf", address: "lantharos/schelf", part: null },
    publisher: { name: "Lantharos", slug: "lantharos", verified: true },
    distribution: "open",
    repository: "Lantharos/Luft",
    releases: [
      {
        version,
        channel: "stable",
        published: new Date().toISOString(),
        rollout: { percent: 100, paused: false },
        files: [
          {
            platform: TARGET,
            kind: "binary",
            url: `${fixture.origin}/${file}`,
            size: program.length,
            sha256: sha256 ?? (await sha256Hex(program)),
            attestation: null,
          },
        ],
      },
    ],
  })
}

const place = () => ({ store: { origin: fixture.origin, rootKey: fixture.rootKey }, folder, target: TARGET })

beforeEach(async () => {
  fixture = await serve()
  folder = await mkdtemp(join(tmpdir(), "schelf-program-"))
})

afterEach(async () => {
  fixture.stop()
  await rm(folder, { recursive: true, force: true })
})

test("downloads the signed program once and runs it from the cache after", async () => {
  await publish("0.4.1", PROGRAM)
  const program = await schelfProgram(place())
  expect(program).toBe(join(folder, "0.4.1", "schelf"))
  expect(new Uint8Array(await readFile(program))).toEqual(PROGRAM)
  const asked = fixture.requests.length
  expect(await schelfProgram(place())).toBe(program)
  expect(fixture.requests.length).toBe(asked)
})

test("refuses a program that isn't what the index signed", async () => {
  await publish("0.4.1", PROGRAM, "0".repeat(64))
  await expect(schelfProgram(place())).rejects.toThrow("isn't the file schelf.store signed for")
})

test("refuses an index signed by a key the root didn't vouch for", async () => {
  await publish("0.4.1", PROGRAM)
  const stranger = await importSigningKey(await generateSigningSeed())
  const key = paths.tool("lantharos", "schelf")
  const forged = await signDocument(stranger, JSON.parse(fixture.files.get(key) as string))
  fixture.files.set(paths.signature(key), forged.signature)
  await expect(schelfProgram(place())).rejects.toThrow("isn't signed by schelf.store")
})

test("refuses a version schelf.store pulled", async () => {
  await publish("0.4.1", PROGRAM)
  await fixture.sign(paths.revocations, {
    issued: new Date().toISOString(),
    blocked: [{ app: "lantharos.schelf", versions: ["0.4.1"], action: "block", reason: "broken" }],
  })
  await expect(schelfProgram(place())).rejects.toThrow("pulled schelf 0.4.1")
})

test("keeps using the last program when schelf.store can't be reached", async () => {
  await publish("0.4.1", PROGRAM)
  const program = await schelfProgram(place())
  const state = join(folder, "state.json")
  await Bun.write(state, JSON.stringify({ ...JSON.parse(await readFile(state, "utf8")), checked: 0 }))
  fixture.stop()
  expect(await schelfProgram(place())).toBe(program)
})
