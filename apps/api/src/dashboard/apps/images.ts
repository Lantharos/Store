export interface Image {
  type: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml"
  extension: "png" | "jpg" | "webp" | "svg"
  width: number
  height: number
}

const SVG_FORBIDDEN = /<script|<foreignObject|\son[a-z]+\s*=|javascript:/i
const SVG_SIZE = 512

function png(bytes: Uint8Array, view: DataView): Image | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null
  return { type: "image/png", extension: "png", width: view.getUint32(16), height: view.getUint32(20) }
}

function jpeg(bytes: Uint8Array, view: DataView): Image | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]!
    const length = view.getUint16(offset + 2)
    const startOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (startOfFrame)
      return {
        type: "image/jpeg",
        extension: "jpg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      }
    offset += 2 + length
  }
  return null
}

function webp(bytes: Uint8Array, view: DataView): Image | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (bytes.length < 30 || text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") return null
  const chunk = text(12, 16)
  const image = { type: "image/webp", extension: "webp" } as const
  if (chunk === "VP8X")
    return {
      ...image,
      width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
      height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
    }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true)
    return { ...image, width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }
  }
  if (chunk === "VP8 ")
    return { ...image, width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  return null
}

function svg(bytes: Uint8Array): Image | null {
  const text = new TextDecoder().decode(bytes)
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text) || SVG_FORBIDDEN.test(text))
    return null
  return { type: "image/svg+xml", extension: "svg", width: SVG_SIZE, height: SVG_SIZE }
}

export function sniffImage(bytes: Uint8Array, allowSvg: boolean): Image | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return png(bytes, view) ?? jpeg(bytes, view) ?? webp(bytes, view) ?? (allowSvg ? svg(bytes) : null)
}
