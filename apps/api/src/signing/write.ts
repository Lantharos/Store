import { env } from "cloudflare:workers"
import { expiresIn, paths, SIGNED_FOR_DAYS, type Stamp, sha256Hex, signDocument } from "@schelf/protocol"
import { signingKey } from "./keys.ts"

export const INDEX_CACHE = "public, max-age=60"
const JSON_TYPE = "application/json"
const NEXT_SERIAL = `INSERT INTO store_state (key, value) VALUES (?1, ?2)
  ON CONFLICT (key) DO UPDATE SET value = max(cast(value as integer) + 1, ?2) RETURNING value`

export interface SignedWrite {
  key: string
  document: object
}

const writing = new Map<string, Promise<void>>()

async function nextSerials(keys: string[]) {
  const statement = env.DB.prepare(NEXT_SERIAL)
  const now = Date.now()
  const results = await env.DB.batch<{ value: string }>(
    keys.map((key) => statement.bind(`serial:${key}`, now)),
  )
  return results.map((result) => Number(result.results[0]!.value))
}

async function put(key: string, body: string, sha256?: string) {
  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType: JSON_TYPE, cacheControl: INDEX_CACHE },
    ...(sha256 && { sha256 }),
  })
}

async function sign(writes: SignedWrite[]) {
  const [key, serials] = await Promise.all([signingKey(), nextSerials(writes.map((write) => write.key))])
  await Promise.all(
    writes.map(async ({ key: path, document }, index) => {
      const stamp: Stamp = { path, serial: serials[index]!, expires: expiresIn(SIGNED_FOR_DAYS) }
      const signed = await signDocument(key, { ...document, ...stamp })
      await Promise.all([
        put(path, signed.body, await sha256Hex(signed.body)),
        put(paths.signature(path), signed.signature),
      ])
    }),
  )
}

/** Signs and stores the documents, after any earlier write of the same files, so serials land in order. */
export function writeSigned(...writes: SignedWrite[]) {
  const earlier = Promise.all(writes.map(({ key }) => writing.get(key)))
  const done = earlier.then(() => sign(writes))
  const settled = done.then(
    () => undefined,
    () => undefined,
  )
  for (const { key } of writes) writing.set(key, settled)
  settled.then(() => {
    for (const { key } of writes) if (writing.get(key) === settled) writing.delete(key)
  })
  return done
}

export async function writeFeed(key: string, document: unknown) {
  await put(key, JSON.stringify(document))
}
