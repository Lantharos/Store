import { env } from "cloudflare:workers"
import { generateSigningSeed, importSigningKey, type StoreKeys, signDocument } from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { prepareSigningKey, publishStoreKeys, signingKey } from "../src/signing/keys.ts"

const LATER = "2026-12-01T00:00:00.000Z"

async function keysSignedBy(seed: string, entries: StoreKeys["keys"]) {
  const root = await importSigningKey(seed)
  return signDocument(root, {
    serial: Date.now(),
    version: 1,
    issued: LATER,
    keys: entries,
    revoked: [],
  } satisfies StoreKeys)
}

describe("store key rotation", () => {
  test("signing moves to a prepared key once the root publishes it", async () => {
    const before = await signingKey()
    const prepared = await prepareSigningKey()
    const entry = (id: string, publicKey: string, notBefore: string) => ({
      id,
      public_key: publicKey,
      not_before: notBefore,
      expires: "2099-01-01T00:00:00.000Z",
    })
    const signed = await keysSignedBy(env.TEST_ROOT_KEY, [
      entry(before.id, before.publicKey, "2026-11-01T00:00:00.000Z"),
      entry(prepared.id, prepared.publicKey, new Date().toISOString()),
    ])
    await publishStoreKeys(signed.body, signed.signature)
    expect((await signingKey()).id).toBe(prepared.id)
    await expect(publishStoreKeys(signed.body, signed.signature)).rejects.toThrow()
  })

  test("keys not signed by the root are refused", async () => {
    const prepared = await prepareSigningKey()
    const forged = await keysSignedBy(await generateSigningSeed(), [
      {
        id: prepared.id,
        public_key: prepared.publicKey,
        not_before: LATER,
        expires: "2099-01-01T00:00:00.000Z",
      },
    ])
    await expect(publishStoreKeys(forged.body, forged.signature)).rejects.toThrow()
  })
})
