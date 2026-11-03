import { env } from "cloudflare:workers"
import { type DeltaReport, MAX_ARTIFACT_SIZE, paths, platform as platformSchema } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { storeHashed } from "../publishing/hashing.ts"
import { fileUrl } from "../signing/records.ts"

const UPDATED_KIND = { sabine: "archive", appimage: "appimage", "luft-extension": "extension" } as const

export async function receiveDelta(
  releaseId: string,
  platformName: string,
  from: string | undefined,
  request: Request,
): Promise<DeltaReport> {
  const platform = platformSchema.parse(platformName)
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, releaseId) })
  if (!release) fail(404, "That release doesn't exist")
  if (release.status !== "checking") fail(409, "This release isn't waiting for checks")
  const app = (await db.query.app.findFirst({ where: eq(schema.app.id, release.appId) }))!
  const [artifact, previous] = await Promise.all([
    db.query.artifact.findFirst({
      where: and(
        eq(schema.artifact.releaseId, release.id),
        eq(schema.artifact.platform, platform),
        eq(schema.artifact.kind, UPDATED_KIND[app.format]),
      ),
    }),
    from
      ? db.query.release.findFirst({
          where: and(
            eq(schema.release.appId, app.id),
            eq(schema.release.channel, release.channel),
            eq(schema.release.version, from),
          ),
        })
      : undefined,
  ])
  if (!artifact) fail(404, `This release has no ${platform} file that updates from a delta`)
  if (!previous?.approvedAt) fail(404, `${app.id} has no approved release ${from}`)
  const size = Number(request.headers.get("content-length"))
  if (!request.body || !Number.isInteger(size) || size <= 0) fail(422, "The delta has no length")
  if (size >= Math.min(artifact.size, MAX_ARTIFACT_SIZE)) fail(422, "The delta isn't smaller than the file")

  const key = paths.delta(app.id, previous.version, release.version, platform)
  const { sha256 } = await storeHashed(env.BUCKET, key, request.body, size)
  await db
    .delete(schema.delta)
    .where(and(eq(schema.delta.artifactId, artifact.id), eq(schema.delta.fromReleaseId, previous.id)))
  await db
    .insert(schema.delta)
    .values({ id: randomId(), artifactId: artifact.id, fromReleaseId: previous.id, key, size, sha256 })
  return { platform, from: previous.version, url: fileUrl(key), size, sha256 }
}
