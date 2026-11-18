import { env } from "cloudflare:workers"
import { toHex, utf8 } from "@schelf/protocol"

let uploadKey: Promise<CryptoKey> | undefined

function key() {
  uploadKey ??= crypto.subtle.importKey(
    "raw",
    utf8(env.UPLOAD_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return uploadKey
}

export async function hmac(message: string) {
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", await key(), utf8(message))))
}

export function equalStrings(left: string, right: string) {
  const a = utf8(left)
  const b = utf8(right)
  return a.length === b.length && crypto.subtle.timingSafeEqual(a, b)
}
