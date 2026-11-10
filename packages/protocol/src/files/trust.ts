import { z } from "zod"
import { utf8 } from "../encoding.ts"
import { keyIdOf, type SignatureEnvelope, verifySignature } from "../signing.ts"
import { stamp } from "./stamp.ts"

export const storeKey = z.object({
  id: z.string(),
  public_key: z.string(),
  not_before: z.iso.datetime(),
  expires: z.iso.datetime(),
})
export type StoreKey = z.infer<typeof storeKey>

export const storeKeyList = z.object({
  keys: z.array(storeKey),
  revoked: z.array(z.string()),
})

export const storeKeys = stamp.extend({
  version: z.literal(1),
  issued: z.iso.datetime(),
  ...storeKeyList.shape,
})
export type StoreKeys = z.infer<typeof storeKeys>

export const BLOCK_ACTIONS = ["block", "warn"] as const
export const blockAction = z.enum(BLOCK_ACTIONS)
export type BlockAction = z.infer<typeof blockAction>

export const blockedEntry = z.object({
  app: z.string(),
  versions: z.union([z.literal("*"), z.array(z.string())]),
  action: blockAction,
  reason: z.string(),
  note: z.string().optional(),
})
export type BlockedEntry = z.infer<typeof blockedEntry>

export const revocations = stamp.extend({
  issued: z.iso.datetime(),
  blocked: z.array(blockedEntry),
})
export type Revocations = z.infer<typeof revocations>

export const REVOCATIONS_MAX_AGE_DAYS = 7

export function blockFor(list: Revocations, app: string, version: string) {
  const id = app.toLowerCase()
  return list.blocked.find(
    (entry) => entry.app.toLowerCase() === id && (entry.versions === "*" || entry.versions.includes(version)),
  )
}

export async function trustedStoreKeys(
  rootPublicKey: string,
  body: string,
  envelope: SignatureEnvelope,
  now = new Date(),
) {
  if (envelope.key !== (await keyIdOf(rootPublicKey)))
    throw new Error("store-keys.json isn't signed by the root")
  if (!(await verifySignature(rootPublicKey, utf8(body), envelope.sig)))
    throw new Error("store-keys.json has a bad signature")
  const document = storeKeyList.parse(JSON.parse(body))
  const trusted = new Map<string, string>()
  for (const key of document.keys) {
    const current = new Date(key.not_before) <= now && now < new Date(key.expires)
    if (current && !document.revoked.includes(key.id) && key.id === (await keyIdOf(key.public_key)))
      trusted.set(key.id, key.public_key)
  }
  return trusted
}
