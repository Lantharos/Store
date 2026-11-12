import { env } from "cloudflare:workers"
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENTS, paths, sha256Hex, sniffImage } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import type { VerificationRow } from "./facts.ts"

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

function documentType(bytes: Uint8Array) {
  if (PDF.every((byte, index) => bytes[index] === byte)) return { type: "application/pdf", extension: "pdf" }
  const image = sniffImage(bytes, false)
  return image && image.type !== "image/webp" ? { type: image.type, extension: image.extension } : null
}

export async function addDocument(verification: VerificationRow, request: Request, name: string) {
  const count = await db.$count(
    schema.verificationDocument,
    eq(schema.verificationDocument.verificationId, verification.id),
  )
  if (count >= MAX_DOCUMENTS) fail(409, `Attach up to ${MAX_DOCUMENTS} documents`)
  const length = Number(request.headers.get("content-length"))
  if (!length || length > MAX_DOCUMENT_BYTES) fail(413, "Documents can be up to 10 MB")
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > MAX_DOCUMENT_BYTES) fail(413, "Documents can be up to 10 MB")
  const kind = documentType(bytes)
  if (!kind) fail(422, "Attach a PDF, PNG or JPEG")
  const key = paths.verificationDocument(verification.id, await sha256Hex(bytes), kind.extension)
  const attached = await db.query.verificationDocument.findFirst({
    where: and(
      eq(schema.verificationDocument.verificationId, verification.id),
      eq(schema.verificationDocument.key, key),
    ),
  })
  if (attached) fail(409, `That's already attached as ${attached.name}`)
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: kind.type } })
  const row = {
    id: randomId(),
    verificationId: verification.id,
    name: name.trim().slice(0, 120) || `document.${kind.extension}`,
    key,
    contentType: kind.type,
    size: bytes.length,
  }
  await db.insert(schema.verificationDocument).values(row)
  return row
}

export async function removeDocument(verification: VerificationRow, id: string) {
  const [removed] = await db
    .delete(schema.verificationDocument)
    .where(
      and(
        eq(schema.verificationDocument.id, id),
        eq(schema.verificationDocument.verificationId, verification.id),
      ),
    )
    .returning()
  if (removed) await env.BUCKET.delete(removed.key)
}

export async function documentFiles(verificationId: string) {
  const rows = await db
    .select()
    .from(schema.verificationDocument)
    .where(eq(schema.verificationDocument.verificationId, verificationId))
  return Promise.all(
    rows.map(async (row) => ({
      name: row.name,
      contentType: row.contentType,
      data: new Uint8Array(await (await env.BUCKET.get(row.key))!.arrayBuffer()),
    })),
  )
}
