const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

export function randomId(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ""
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}
