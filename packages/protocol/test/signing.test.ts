import { describe, expect, test } from "bun:test"
import {
  generateSigningSeed,
  importSigningKey,
  type SabineFeed,
  type StoreKeys,
  sabineSigningPayload,
  signDocument,
  signSabineFeed,
  toBase64,
  trustedStoreKeys,
  verifyDocument,
  verifySabineFeed,
} from "../src/index.ts"

const SABINE_TEST_SEED = toBase64(new Uint8Array(32).fill(7))

const feed: SabineFeed = {
  schema: 1,
  app_id: "io.github.mira.cadence",
  version: "2.4.0",
  channel: "stable",
  published_at: "1793700000",
  requires_sabine: { major: 0, build: 68 },
  artifacts: {
    "windows-x86_64": {
      url: "https://dl.schelf.store/apps/io.github.mira.cadence/2.4.0/windows-x86_64/cadence.zip",
      sha256: "b".repeat(64),
      kind: "archive",
      executable: "Cadence.exe",
    },
    "linux-x86_64-deb": {
      url: "https://dl.schelf.store/apps/io.github.mira.cadence/2.4.0/linux-x86_64/cadence.deb",
      sha256: "a".repeat(64),
      kind: "deb",
      executable: null,
    },
  },
  signature: "",
}

describe("Sabine feeds", () => {
  test("sign the bytes serde_json writes for AppReleaseManifest", () => {
    expect(sabineSigningPayload({ ...feed, signature: "ignored" })).toBe(
      '{"schema":1,"app_id":"io.github.mira.cadence","version":"2.4.0","channel":"stable","published_at":"1793700000","requires_sabine":{"major":0,"build":68},"artifacts":{"linux-x86_64-deb":{"url":"https://dl.schelf.store/apps/io.github.mira.cadence/2.4.0/linux-x86_64/cadence.deb","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","kind":"deb","executable":null},"windows-x86_64":{"url":"https://dl.schelf.store/apps/io.github.mira.cadence/2.4.0/windows-x86_64/cadence.zip","sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","kind":"archive","executable":"Cadence.exe"}},"signature":""}',
    )
  })

  test("put the rollout and the key id between the artifacts and the signature", () => {
    const payload = sabineSigningPayload({ ...feed, artifacts: {}, rollout: 25, key: "95928d1f0502af33" })
    expect(payload.endsWith(',"artifacts":{},"rollout":25,"key":"95928d1f0502af33","signature":""}')).toBe(
      true,
    )
  })

  test("verify after a JSON round trip and refuse tampering", async () => {
    const key = await importSigningKey(SABINE_TEST_SEED)
    const signed = await signSabineFeed(key, feed)
    const received = JSON.parse(JSON.stringify(signed)) as SabineFeed
    expect(await verifySabineFeed(key.publicKey, received)).toBe(true)
    expect(received.key).toBe(key.id)
    expect(await verifySabineFeed(key.publicKey, { ...received, version: "2.4.1" })).toBe(false)
    expect(await verifySabineFeed(key.publicKey, { ...received, rollout: 100 })).toBe(false)
  })
})

describe("signed documents", () => {
  test("verify through a root-signed store-keys.json", async () => {
    const root = await importSigningKey(await generateSigningSeed())
    const store = await importSigningKey(await generateSigningSeed())
    const now = new Date("2026-11-03T00:00:00Z")
    const keys: StoreKeys = {
      serial: 1,
      expires: "2027-01-01T00:00:00.000Z",
      version: 1,
      issued: now.toISOString(),
      keys: [
        {
          id: store.id,
          public_key: store.publicKey,
          not_before: "2026-11-01T00:00:00.000Z",
          expires: "2027-11-01T00:00:00.000Z",
        },
      ],
      revoked: [],
    }
    const signedKeys = await signDocument(root, keys)
    const trusted = await trustedStoreKeys(
      root.publicKey,
      signedKeys.body,
      JSON.parse(signedKeys.signature),
      now,
    )
    const document = await signDocument(store, { version: 1, apps: [] })
    expect(await verifyDocument(trusted, document.body, JSON.parse(document.signature))).toBe(true)
    expect(await verifyDocument(trusted, `${document.body} `, JSON.parse(document.signature))).toBe(false)

    const revoked = await signDocument(root, { ...keys, revoked: [store.id] })
    const afterRevocation = await trustedStoreKeys(
      root.publicKey,
      revoked.body,
      JSON.parse(revoked.signature),
      now,
    )
    expect(await verifyDocument(afterRevocation, document.body, JSON.parse(document.signature))).toBe(false)

    const forged = await signDocument(store, keys)
    expect(trustedStoreKeys(root.publicKey, forged.body, JSON.parse(forged.signature), now)).rejects.toThrow()
  })
})
