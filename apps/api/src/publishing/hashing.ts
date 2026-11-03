import { toHex } from "@schelf/protocol"

export function hashingStream() {
  const digest = new crypto.DigestStream("SHA-256")
  const writer = digest.getWriter()
  const tap = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      await writer.write(chunk)
      controller.enqueue(chunk)
    },
    async flush() {
      await writer.close()
    },
  })
  return { tap, sha256: async () => toHex(new Uint8Array(await digest.digest)) }
}

export async function sha256OfStream(stream: ReadableStream<Uint8Array>) {
  const digest = new crypto.DigestStream("SHA-256")
  await stream.pipeTo(digest)
  return toHex(new Uint8Array(await digest.digest))
}

export async function storeHashed(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  size: number,
) {
  const { tap, sha256 } = hashingStream()
  const sized = new FixedLengthStream(size)
  const piping = body.pipeThrough(tap).pipeTo(sized.writable)
  const [object] = await Promise.all([
    bucket.put(key, sized.readable, {
      httpMetadata: { cacheControl: "public, max-age=31536000, immutable" },
    }),
    piping,
  ])
  return { object, sha256: await sha256() }
}
