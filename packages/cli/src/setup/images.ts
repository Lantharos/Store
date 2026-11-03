const PNG_SIGNATURE = 0x89504e47
const JPEG_START = 0xffd8
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length > 24 && view.getUint32(0) === PNG_SIGNATURE)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  if (bytes.length < 4 || view.getUint16(0) !== JPEG_START) return undefined
  for (let offset = 2; offset + 9 < bytes.length; ) {
    if (bytes[offset] !== 0xff) return undefined
    const marker = bytes[offset + 1]!
    if (JPEG_FRAMES.has(marker))
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    offset += 2 + view.getUint16(offset + 2)
  }
  return undefined
}
