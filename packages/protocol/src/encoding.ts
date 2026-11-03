export function toBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(encoded: string) {
  const binary = atob(encoded.trim())
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function utf8(text: string) {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
}

export async function sha256Hex(data: string | Uint8Array<ArrayBuffer>) {
  const bytes = typeof data === "string" ? utf8(data) : data
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
}
