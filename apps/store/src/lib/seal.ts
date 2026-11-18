import { env } from "cloudflare:workers"
import { fromBase64, toBase64, utf8 } from "@schelf/protocol"

const IV_BYTES = 12
let sealingKey: Promise<CryptoKey> | undefined

function key() {
  sealingKey ??= crypto.subtle.importKey("raw", fromBase64(env.SEALING_KEY), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ])
  return sealingKey
}

export async function seal(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), utf8(plaintext))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`
}

export async function unseal(sealed: string) {
  const [iv, cipher] = sealed.split(".")
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv!) },
    await key(),
    fromBase64(cipher!),
  )
  return new TextDecoder().decode(plain)
}
