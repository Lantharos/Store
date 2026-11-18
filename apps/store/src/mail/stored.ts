import { env } from "cloudflare:workers"
import { b } from "@lantharos/pult"
import { type Mail, readMail } from "./parse.ts"

export const storedKey = (id: string) => `mail/${id}.eml`
export const quarantinedKey = (id: string) => `mail/quarantine/${id}.eml`

export function storeRaw(key: string, raw: ArrayBuffer) {
  return env.BUCKET.put(key, raw, { httpMetadata: { contentType: "message/rfc822" } })
}

export async function readStored(key: string) {
  const object = await env.BUCKET.get(key)
  if (!object) return null
  const raw = await object.arrayBuffer()
  return { raw, mail: await readMail(raw) }
}

export function attachmentsOf(mail: Mail, raw: ArrayBuffer) {
  return [
    ...mail.files.map((file) => b.attachment(file)),
    b.attachment({ name: "message.eml", contentType: "message/rfc822", data: raw }),
  ]
}
