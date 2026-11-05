import { env } from "cloudflare:workers"
import { type CheckResult, type CompleteResponse, partsFor, paths, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { GitHubError, repository } from "../github/api.ts"
import { type Attestation, findAttestation } from "../github/attestations.ts"
import { refuseEnded } from "../hosting/ended.ts"
import { fail } from "../lib/http.ts"
import { recordHistory } from "../ops/events.ts"
import { dispatchChecks, failedChecks } from "../releases/checks.ts"
import { routeRelease } from "../releases/review.ts"
import type { ArtifactRow, ReleaseRow } from "../signing/records.ts"
import { searchKeys, storeKey } from "../storefront/search-index.ts"
import { digestsOfStream } from "./hashing.ts"
import { quickChecks } from "./quick-checks.ts"
import { dashboardUrl } from "./start.ts"

async function finishMultipart(artifact: ArtifactRow) {
  const parts = await db.select().from(schema.uploadPart).where(eq(schema.uploadPart.artifactId, artifact.id))
  if (parts.length !== partsFor(artifact.size)) fail(409, `${artifact.name} is missing parts`)
  await env.BUCKET.resumeMultipartUpload(artifact.key, artifact.uploadId!).complete(
    parts
      .sort((left, right) => left.part - right.part)
      .map((part) => ({ partNumber: part.part, etag: part.etag })),
  )
  const object = await env.BUCKET.get(artifact.key)
  const digests = object && (await digestsOfStream(object.body))
  if (!digests || digests.sha256 !== artifact.sha256) {
    await env.BUCKET.delete(artifact.key)
    fail(422, `${artifact.name} doesn't match the SHA-256 it was announced with`)
  }
  await db
    .update(schema.artifact)
    .set({ uploadedAt: new Date(), sha512: digests.sha512 })
    .where(eq(schema.artifact.id, artifact.id))
}

async function attestationsFor(release: ReleaseRow, artifacts: ArtifactRow[], repositoryName: string | null) {
  const found = new Map<string, Attestation | "unverifiable" | null>()
  if (release.origin !== "oidc" || !repositoryName) return found
  try {
    const repo = await repository(repositoryName)
    for (const artifact of artifacts)
      found.set(
        artifact.id,
        repo ? await findAttestation(repo.full_name, String(repo.id), artifact.sha256) : "unverifiable",
      )
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error
    console.warn(`Couldn't read attestations for ${repositoryName}: ${error.message}`)
    for (const artifact of artifacts) found.set(artifact.id, "unverifiable")
  }
  return found
}

async function lookalikes(appId: string, name: string | undefined) {
  if (!name) return []
  const hits = await searchKeys(name, 20)
  return hits
    .filter((hit) => hit.key !== storeKey(appId))
    .map((hit) => ({ id: hit.key.slice(hit.key.indexOf(":") + 1), name: hit.name }))
}

export async function saveChecks(release: ReleaseRow, checks: CheckResult[]) {
  await Promise.all(
    checks
      .filter((check) => check.detail !== undefined)
      .map((check) =>
        env.BUCKET.put(
          paths.check(release.appId, release.version, check.name),
          JSON.stringify(check.detail),
          {
            httpMetadata: { contentType: "application/json" },
          },
        ),
      ),
  )
  await db.batch(
    checks.map((check) =>
      db
        .insert(schema.check)
        .values({
          releaseId: release.id,
          name: check.name,
          status: check.status,
          summary: check.summary,
          detailKey:
            check.detail === undefined ? null : paths.check(release.appId, release.version, check.name),
        })
        .onConflictDoUpdate({
          target: [schema.check.releaseId, schema.check.name],
          set: { status: check.status, summary: check.summary, createdAt: new Date() },
        }),
    ) as never,
  )
}

export async function completeRelease(releaseId: string): Promise<CompleteResponse> {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, releaseId) })
  if (!release) fail(404, "That release doesn't exist")
  if (release.status !== "uploading") fail(409, "This release was already completed")
  await refuseEnded(release.appId, release.channel)
  const app = (await db.query.app.findFirst({ where: eq(schema.app.id, release.appId) }))!
  const artifacts = await db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release.id))
  for (const artifact of artifacts) {
    if (artifact.uploadedAt) continue
    if (!artifact.uploadId) fail(409, `${artifact.name} hasn't been uploaded`)
    await finishMultipart(artifact)
  }

  const [previous, namespaces, listing, meta, screenshots, attestations] = await Promise.all([
    db.query.release.findFirst({
      where: and(
        eq(schema.release.appId, app.id),
        eq(schema.release.channel, release.channel),
        ne(schema.release.id, release.id),
        isNotNull(schema.release.approvedAt),
        inArray(schema.release.status, [...SHIPPED_STATUSES, "withdrawn"]),
      ),
      orderBy: desc(schema.release.approvedAt),
    }),
    db.select().from(schema.namespace).where(eq(schema.namespace.publisherId, app.publisherId)),
    db.select().from(schema.listing).where(eq(schema.listing.appId, app.id)),
    db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, app.id) }),
    db.$count(schema.screenshot, eq(schema.screenshot.appId, app.id)),
    attestationsFor(release, artifacts, app.repository),
  ])
  const name = listing.find((entry) => entry.locale === "en")?.name
  const checks = quickChecks({
    app,
    release,
    previous: previous ?? null,
    artifacts,
    attestations,
    namespaces,
    listing,
    meta: meta ?? null,
    screenshots,
    lookalikes: await lookalikes(app.id, name),
  })
  await Promise.all(
    artifacts.flatMap((artifact) => {
      const attestation = attestations.get(artifact.id)
      return attestation && attestation !== "unverifiable"
        ? [
            db
              .update(schema.artifact)
              .set({ attestationUrl: attestation.url })
              .where(eq(schema.artifact.id, artifact.id)),
          ]
        : []
    }),
  )
  await saveChecks(release, checks)
  const widened = checks.some(
    (check) => check.name === "permissions" && check.status === "warning" && previous,
  )
  const failedCheck = checks.some((check) => check.status === "failed")
  const status = failedCheck ? "failed" : "checking"
  if (failedCheck) recordHistory("release", release.id, failedChecks(checks))
  await db
    .update(schema.release)
    .set({ status, permissionsWidened: widened })
    .where(eq(schema.release.id, release.id))
  if (!failedCheck) {
    const dispatched = await dispatchChecks({ ...release, status }, app, artifacts, previous ?? null).catch(
      (error: unknown) => {
        if (!(error instanceof GitHubError)) throw error
        console.error(`Couldn't start the checks for ${app.id} ${release.version}: ${error.message}`)
        return false
      },
    )
    if (!dispatched) await routeRelease(release.id)
  }
  const current = await db.query.release.findFirst({ where: eq(schema.release.id, release.id) })
  return { release: release.id, status: current!.status, checks, dashboard: dashboardUrl(app.id, release.id) }
}
