import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  DOWNLOAD_ORIGIN,
  importSigningKey,
  keyIdOf,
  paths,
  ROOT_KEY,
  type StoreKeys,
  serialAfter,
  signDocument,
  storeKeys,
  type Unstamped,
} from "@schelf/protocol"

const YEAR_MS = 365 * 24 * 3_600_000
const COMMANDS = ["init", "add", "revoke", "renew"]
const [command, ...rest] = process.argv.slice(2)
const [value, out = "trust-out"] = command === "renew" ? ["", ...rest] : rest
const rootSeed = process.env.ROOT_KEY

if (!rootSeed || !command || !COMMANDS.includes(command) || (command !== "renew" && !value)) {
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts init <signing public key> [out dir]")
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts add <signing public key> [out dir]")
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts revoke <key id> [out dir]")
  console.error("ROOT_KEY=<root seed> bun scripts/store-keys.ts renew [out dir]")
  process.exit(1)
}

const root = await importSigningKey(rootSeed)
if (root.id !== ROOT_KEY.id) throw new Error("That isn't the store's root key")

async function publishedKeys(): Promise<Unstamped<StoreKeys> & Partial<StoreKeys>> {
  if (command === "init") return { version: 1, issued: new Date().toISOString(), keys: [], revoked: [] }
  const response = await fetch(`${DOWNLOAD_ORIGIN}/${paths.storeKeys}`)
  if (!response.ok) throw new Error(`Couldn't read the published store keys: ${response.status}`)
  return storeKeys.partial({ serial: true }).parse(await response.json())
}

const current = await publishedKeys()

const now = new Date()
const changed =
  command === "revoke"
    ? { revoked: [...new Set([...current.revoked, value])] }
    : command === "renew"
      ? {}
      : {
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
const next: StoreKeys = {
  ...current,
  ...changed,
  issued: now.toISOString(),
  serial: serialAfter(current.serial ?? 0, now.getTime()),
}

const signed = await signDocument(root, next)
mkdirSync(join(out, "trust/v1"), { recursive: true })
writeFileSync(join(out, paths.storeKeys), signed.body)
writeFileSync(join(out, paths.signature(paths.storeKeys)), signed.signature)
writeFileSync(join(out, paths.root), `${ROOT_KEY.public_key}\n`)
console.log(`Wrote ${out}/trust/v1; upload each file to the bucket at the same path.`)
