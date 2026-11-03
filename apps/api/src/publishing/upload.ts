import { env } from "cloudflare:workers"
import { PART_SIZE, partsFor, type UploadResponse } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { storeHashed } from "./hashing.ts"

function partNumber(value: string | undefined, parts: number) {
  const part = Number(value)
  if (!Number.isInteger(part) || part < 1 || part > parts)
    fail(422, `This file goes up in ${parts} parts, numbered from 1`)
  return part
}

async function uploadingArtifact(releaseId: string, name: string) {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, releaseId) })
  if (!release) fail(404, "That release doesn't exist")
  if (release.status !== "uploading") fail(409, "This release isn't taking uploads any more")
  const artifact = await db.query.artifact.findFirst({
    where: and(eq(schema.artifact.releaseId, releaseId), eq(schema.artifact.name, name)),
  })
  if (!artifact) fail(404, `${name} wasn't announced for this release`)
  return artifact
}

export async function receiveFile(
  releaseId: string,
  name: string,
  request: Request,
  part: string | undefined,
): Promise<UploadResponse> {
  const artifact = await uploadingArtifact(releaseId, name)
  const length = Number(request.headers.get("content-length"))
  if (!request.body) fail(422, "The upload has no body")
  const parts = partsFor(artifact.size)

  if (parts === 1) {
    if (length !== artifact.size) fail(422, `${name} should be ${artifact.size} bytes, not ${length}`)
    const { sha256, sha512 } = await storeHashed(env.BUCKET, artifact.key, request.body, artifact.size)
    if (sha256 !== artifact.sha256) {
      await env.BUCKET.delete(artifact.key)
      fail(422, `${name} doesn't match the SHA-256 it was announced with`)
    }
    await db
      .update(schema.artifact)
      .set({ uploadedAt: new Date(), sha512 })
      .where(eq(schema.artifact.id, artifact.id))
    return { name, part: null, received: artifact.size }
  }

  const number = partNumber(part, parts)
  const expected = number < parts ? PART_SIZE : artifact.size - PART_SIZE * (parts - 1)
  if (length !== expected) fail(422, `Part ${number} of ${name} should be ${expected} bytes, not ${length}`)
  const upload = env.BUCKET.resumeMultipartUpload(artifact.key, artifact.uploadId!)
  const uploaded = await upload.uploadPart(number, request.body)
  await db
    .insert(schema.uploadPart)
    .values({ artifactId: artifact.id, part: number, etag: uploaded.etag })
    .onConflictDoUpdate({
      target: [schema.uploadPart.artifactId, schema.uploadPart.part],
      set: { etag: uploaded.etag },
    })
  return { name, part: number, received: length }
}
