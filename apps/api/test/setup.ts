import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { importSigningKey, paths, signDocument } from "@schelf/protocol"

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

const root = await importSigningKey(env.TEST_ROOT_KEY)
const store = await importSigningKey(env.STORE_SIGNING_KEY)
const signed = await signDocument(root, {
  version: 1,
  issued: "2026-11-01T00:00:00.000Z",
  keys: [
    {
      id: store.id,
      public_key: store.publicKey,
      not_before: "2026-11-01T00:00:00.000Z",
      expires: "2099-01-01T00:00:00.000Z",
    },
  ],
  revoked: [],
})
await env.BUCKET.put(paths.storeKeys, signed.body)
await env.BUCKET.put(paths.signature(paths.storeKeys), signed.signature)
