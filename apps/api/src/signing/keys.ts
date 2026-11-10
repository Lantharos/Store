import { env } from "cloudflare:workers"
import {
  generateSigningSeed,
  importSigningKey,
  paths,
  type SigningKey,
  signatureEnvelope,
  storeKeyList,
  storeKeys,
  trustedStoreKeys,
} from "@schelf/protocol"
import { db, schema } from "../db/client.ts"
import { seal, unseal } from "../lib/seal.ts"
import { INDEX_CACHE } from "./write.ts"

const FRESH_MS = 60_000

let current: { key: Promise<SigningKey>; at: number } | undefined

async function heldKeys() {
  const rows = await db.select().from(schema.signingKey)
  const keys = await Promise.all([
    importSigningKey(env.STORE_SIGNING_KEY),
    ...rows.map(async (row) => importSigningKey(await unseal(row.sealedSeed))),
  ])
  return new Map(keys.map((key) => [key.id, key]))
}

async function publishedKeys() {
  const [body, signature] = await Promise.all([
    env.BUCKET.get(paths.storeKeys).then((object) => object?.text()),
    env.BUCKET.get(paths.signature(paths.storeKeys)).then((object) => object?.json()),
  ])
  if (!body || !signature) throw new Error("trust/v1/store-keys.json isn't published")
  return { body, signature: signatureEnvelope.parse(signature) }
}

async function chooseKey() {
  const published = await publishedKeys()
  const trusted = await trustedStoreKeys(env.ROOT_PUBLIC_KEY, published.body, published.signature)
  const held = await heldKeys()
  const newestFirst = storeKeyList
    .parse(JSON.parse(published.body))
    .keys.filter((entry) => trusted.has(entry.id) && held.has(entry.id))
    .sort((left, right) => right.not_before.localeCompare(left.not_before))
  const chosen = newestFirst[0]
  if (!chosen) throw new Error("No store key that the root vouches for is held by the Worker")
  return held.get(chosen.id)!
}

export function signingKey() {
  if (!current || Date.now() - current.at > FRESH_MS) {
    const key = chooseKey()
    current = { key, at: Date.now() }
    key.catch(() => {
      current = undefined
    })
  }
  return current.key
}

export function forgetSigningKey() {
  current = undefined
}

export async function prepareSigningKey() {
  const seed = await generateSigningSeed()
  const key = await importSigningKey(seed)
  await db
    .insert(schema.signingKey)
    .values({ id: key.id, publicKey: key.publicKey, sealedSeed: await seal(seed) })
  return key
}

export async function publishStoreKeys(body: string, signatureText: string) {
  const signature = signatureEnvelope.parse(JSON.parse(signatureText))
  const trusted = await trustedStoreKeys(env.ROOT_PUBLIC_KEY, body, signature)
  if (new Date(storeKeys.parse(JSON.parse(body)).expires) <= new Date())
    throw new Error("These store keys have already expired; sign them again with the root")
  const held = await heldKeys()
  if (![...trusted.keys()].some((id) => held.has(id)))
    throw new Error("None of these keys is held by the Worker; prepare one first")
  const metadata = { httpMetadata: { contentType: "application/json", cacheControl: INDEX_CACHE } }
  await env.BUCKET.put(paths.storeKeys, body, metadata)
  await env.BUCKET.put(paths.signature(paths.storeKeys), JSON.stringify(signature), metadata)
  forgetSigningKey()
  return [...trusted.keys()]
}
