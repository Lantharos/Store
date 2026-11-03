import { toBase64, toHex } from "@schelf/protocol"

export interface Digests {
  sha256: string
  sha512: string
}

function digestWriters() {
  const sha256 = new crypto.DigestStream("SHA-256")
  const sha512 = new crypto.DigestStream("SHA-512")
  const writers = [sha256.getWriter(), sha512.getWriter()]
  return {
    write: (chunk: Uint8Array) => Promise.all(writers.map((writer) => writer.write(chunk))),
    close: () => Promise.all(writers.map((writer) => writer.close())),
    digests: async (): Promise<Digests> => ({
      sha256: toHex(new Uint8Array(await sha256.digest)),
      sha512: toBase64(new Uint8Array(await sha512.digest)),
    }),
  }
}

export function hashingStream() {
  const digests = digestWriters()
  const tap = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      await digests.write(chunk)
      controller.enqueue(chunk)
    },
    flush: () => digests.close().then(() => undefined),
  })
  return { tap, digests: digests.digests }
}

export async function digestsOfStream(stream: ReadableStream<Uint8Array>) {
  const digests = digestWriters()
  await stream.pipeTo(
    new WritableStream({
      write: (chunk) => digests.write(chunk).then(() => undefined),
      close: () => digests.close().then(() => undefined),
    }),
  )
  return digests.digests()
}

export async function storeHashed(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  size: number,
) {
  const { tap, digests } = hashingStream()
  const sized = new FixedLengthStream(size)
  const piping = body.pipeThrough(tap).pipeTo(sized.writable)
  const [object] = await Promise.all([
    bucket.put(key, sized.readable, {
      httpMetadata: { cacheControl: "public, max-age=31536000, immutable" },
    }),
    piping,
  ])
  return { object, ...(await digests()) }
}
