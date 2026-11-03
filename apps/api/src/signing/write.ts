import { env } from "cloudflare:workers"
import { paths, sha256Hex, signDocument } from "@schelf/protocol"
import { signingKey } from "./keys.ts"

export const INDEX_CACHE = "public, max-age=60"
const JSON_TYPE = "application/json"

export async function writeSigned(key: string, document: unknown) {
  const signed = await signDocument(await signingKey(), document)
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
