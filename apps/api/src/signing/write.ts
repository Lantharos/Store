import { env } from "cloudflare:workers"
import { expiresIn, paths, SIGNED_FOR_DAYS, type Stamp, sha256Hex, signDocument } from "@schelf/protocol"
import { sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { signingKey } from "./keys.ts"

export const INDEX_CACHE = "public, max-age=60"
const JSON_TYPE = "application/json"

async function nextSerial(key: string) {
  const now = Date.now()
  const [row] = await db
    .insert(schema.storeState)
    .values({ key: `serial:${key}`, value: String(now) })
    .onConflictDoUpdate({
      target: schema.storeState.key,
      set: { value: sql`max(cast(${schema.storeState.value} as integer) + 1, ${now})` },
    })
    .returning()
  return Number(row!.value)
}

export async function writeSigned(key: string, document: object) {
  const stamp: Stamp = { serial: await nextSerial(key), expires: expiresIn(SIGNED_FOR_DAYS) }
  const signed = await signDocument(await signingKey(), { ...document, ...stamp })
  await env.BUCKET.put(key, signed.body, {
    httpMetadata: { contentType: JSON_TYPE, cacheControl: INDEX_CACHE },
    sha256: await sha256Hex(signed.body),
  })
  await env.BUCKET.put(paths.signature(key), signed.signature, {
    httpMetadata: { contentType: JSON_TYPE, cacheControl: INDEX_CACHE },
  })
}

export async function writeFeed(key: string, document: unknown) {
  await env.BUCKET.put(key, JSON.stringify(document), {
    httpMetadata: { contentType: JSON_TYPE, cacheControl: INDEX_CACHE },
  })
}
