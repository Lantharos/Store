import { z } from "zod"
import { fromBase64, sha256Hex, toBase64, utf8 } from "./encoding.ts"

const ED25519 = { name: "Ed25519" } as const
const PKCS8_SEED_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])
const SEED_BYTES = 32
const SIGNATURE_BYTES = 64

export const signatureEnvelope = z.object({ key: z.string(), sig: z.string() })
export type SignatureEnvelope = z.infer<typeof signatureEnvelope>

export interface SigningKey {
  id: string
  publicKey: string
  sign(payload: Uint8Array<ArrayBuffer>): Promise<string>
}

export async function keyIdOf(publicKey: string) {
  return (await sha256Hex(fromBase64(publicKey))).slice(0, 16)
}

export async function importSigningKey(seed: string): Promise<SigningKey> {
  const bytes = fromBase64(seed)
  if (bytes.length !== SEED_BYTES) throw new Error("An Ed25519 private key is a 32-byte seed")
  const pkcs8 = new Uint8Array(PKCS8_SEED_PREFIX.length + SEED_BYTES)
  pkcs8.set(PKCS8_SEED_PREFIX)
  pkcs8.set(bytes, PKCS8_SEED_PREFIX.length)
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, ED25519, true, ["sign"])
  const jwk = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey
  const publicKey = toBase64(fromBase64Url(jwk.x!))
  return {
    id: await keyIdOf(publicKey),
    publicKey,
    sign: async (payload) => toBase64(new Uint8Array(await crypto.subtle.sign(ED25519, privateKey, payload))),
  }
}

export async function generateSigningSeed() {
  const pair = (await crypto.subtle.generateKey(ED25519, true, ["sign", "verify"])) as CryptoKeyPair
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer)
  return toBase64(pkcs8.slice(-SEED_BYTES))
}

const publicKeys = new Map<string, Promise<CryptoKey>>()

function publicKeyFor(publicKey: string) {
  let key = publicKeys.get(publicKey)
  if (!key) {
    key = crypto.subtle.importKey("raw", fromBase64(publicKey), ED25519, false, ["verify"])
    publicKeys.set(publicKey, key)
  }
  return key
}

export async function verifySignature(
  publicKey: string,
  payload: Uint8Array<ArrayBuffer>,
  signature: string,
) {
  const bytes = fromBase64(signature)
  if (bytes.length !== SIGNATURE_BYTES) return false
  return crypto.subtle.verify(ED25519, await publicKeyFor(publicKey), bytes, payload)
}

export async function signDocument(key: SigningKey, document: unknown) {
  const body = JSON.stringify(document)
  const envelope: SignatureEnvelope = { key: key.id, sig: await key.sign(utf8(body)) }
  return { body, signature: JSON.stringify(envelope) }
}

export async function verifyDocument(keys: Map<string, string>, body: string, envelope: SignatureEnvelope) {
  const publicKey = keys.get(envelope.key)
  return publicKey !== undefined && verifySignature(publicKey, utf8(body), envelope.sig)
}

function fromBase64Url(encoded: string) {
  return fromBase64(
    encoded
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "="),
  )
}
