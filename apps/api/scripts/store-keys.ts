import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  DOWNLOAD_ORIGIN,
  importSigningKey,
  keyIdOf,
  paths,
  ROOT_KEY,
  type StoreKeys,
  signDocument,
  storeKeys,
} from "@schelf/protocol"

const YEAR_MS = 365 * 24 * 3_600_000
const [command, value, out = "trust-out"] = process.argv.slice(2)
const rootSeed = process.env.ROOT_KEY

if (!rootSeed || !command || !value || !["init", "add", "revoke"].includes(command)) {
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts init <signing public key> [out dir]")
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts add <signing public key> [out dir]")
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts revoke <key id> [out dir]")
  process.exit(1)
}

const root = await importSigningKey(rootSeed)
if (root.id !== ROOT_KEY.id) throw new Error("That isn't the store's root key")

async function publishedKeys(): Promise<StoreKeys> {
  if (command === "init") return { version: 1, issued: new Date().toISOString(), keys: [], revoked: [] }
  const response = await fetch(`${DOWNLOAD_ORIGIN}/${paths.storeKeys}`)
  if (!response.ok) throw new Error(`Couldn't read the published store keys: ${response.status}`)
  return storeKeys.parse(await response.json())
}

const current = await publishedKeys()

const now = new Date()
const next: StoreKeys =
  command === "revoke"
    ? { ...current, issued: now.toISOString(), revoked: [...new Set([...current.revoked, value])] }
    : {
        ...current,
        issued: now.toISOString(),
        keys: [
          ...current.keys,
          {
            id: await keyIdOf(value),
            public_key: value,
            not_before: now.toISOString(),
            expires: new Date(now.getTime() + YEAR_MS).toISOString(),
          },
        ],
      }

const signed = await signDocument(root, next)
mkdirSync(join(out, "trust/v1"), { recursive: true })
writeFileSync(join(out, paths.storeKeys), signed.body)
writeFileSync(join(out, paths.signature(paths.storeKeys)), signed.signature)
writeFileSync(join(out, paths.root), `${ROOT_KEY.public_key}\n`)
console.log(`Wrote ${out}/trust/v1; upload each file to the bucket at the same path.`)
