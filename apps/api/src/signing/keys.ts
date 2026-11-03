import { env } from "cloudflare:workers"
import { importSigningKey, type SigningKey } from "@schelf/protocol"

let storeKey: Promise<SigningKey> | undefined

export function signingKey() {
  storeKey ??= importSigningKey(env.STORE_SIGNING_KEY)
  return storeKey
}
