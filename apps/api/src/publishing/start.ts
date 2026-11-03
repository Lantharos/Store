import { env } from "cloudflare:workers"
import {
  PART_SIZE,
  type Permissions,
  type PublishRequest,
  type PublishResponse,
  partsFor,
  paths,
  readPermissions,
  readSchelfToml,
  type SchelfToml,
  versionFromTag,
} from "@schelf/protocol"
import { and, eq, sql } from "drizzle-orm"
import { ZodError } from "zod"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { acceptingSubmissions } from "../ops/events.ts"
import type { AppRow } from "../signing/records.ts"
import { identifyPublisher, type Publisher } from "./publisher.ts"
import { issueUploadToken } from "./upload-token.ts"

const RETRYABLE = new Set(["uploading", "failed"])

function readManifest(text: string): SchelfToml {
  try {
    return readSchelfToml(text)
  } catch (error) {
    if (error instanceof ZodError) throw error
    fail(422, `schelf.toml doesn't parse: ${(error as Error).message}`)
  }
}

function declaredPermissions(manifest: SchelfToml, text: string | undefined): Permissions | null {
  if (!manifest.permissions) return null
  if (text === undefined) fail(422, `schelf.toml names ${manifest.permissions}; send its contents too`)
  return readPermissions(text)
}

export async function appById(id: string) {
  return db.query.app.findFirst({ where: sql`lower(${schema.app.id}) = lower(${id})` })
}

async function clearAbandoned(app: AppRow, version: string) {
  const existing = await db.query.release.findFirst({
    where: and(
      eq(schema.release.appId, app.id),
      eq(schema.release.channel, "stable"),
      eq(schema.release.version, version),
    ),
  })
  if (!existing) return
  if (!RETRYABLE.has(existing.status)) fail(409, `${app.id} ${version} was already published`)
  const artifacts = await db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, existing.id))
  await Promise.all(
    artifacts.map((artifact) =>
      artifact.uploadId && !artifact.uploadedAt
        ? env.BUCKET.resumeMultipartUpload(artifact.key, artifact.uploadId).abort()
        : env.BUCKET.delete(artifact.key),
    ),
  )
  await db.delete(schema.release).where(eq(schema.release.id, existing.id))
}

export function dashboardUrl(app: string, release: string) {
  return `${env.PUBLIC_URL}/dashboard/apps/${app}/releases/${release}`
}

export async function startRelease(
  credential: string | null,
  body: PublishRequest,
): Promise<PublishResponse> {
  const manifest = readManifest(body.schelf_toml)
  const app = await appById(manifest.id)
  if (!app)
    fail(
      404,
      `${manifest.id} isn't registered on schelf.store yet; add it in the dashboard or run schelf init`,
    )
  if (app.status === "pulled") fail(403, `${app.id} was pulled from the store`)
  if (app.kind !== manifest.kind || app.format !== manifest.format)
    fail(
      422,
      `${app.id} is registered as a ${app.format} ${app.kind}, not a ${manifest.format} ${manifest.kind}`,
    )
  const publisher: Publisher = await identifyPublisher(credential, app, body.tag)
  const developer = await db.query.developer.findFirst({ where: eq(schema.developer.id, app.developerId) })
  if (developer?.status !== "active") fail(403, "This developer account can't publish right now")
  if (!(await acceptingSubmissions())) fail(503, "schelf.store isn't taking new releases for a little while")

  const version = body.version ?? versionFromTag(body.tag)
  if (!version) fail(422, `${body.tag} doesn't look like a version; pass the version explicitly`)
  const names = new Set(body.files.map((file) => file.name))
  if (names.size !== body.files.length) fail(422, "Two files have the same name")
  await clearAbandoned(app, version)

  const releaseId = randomId()
  const artifacts = await Promise.all(
    body.files.map(async (file) => {
      const key = paths.artifact(app.id, version, file.platform, file.name)
      const parts = partsFor(file.size)
      const uploadId = parts > 1 ? (await env.BUCKET.createMultipartUpload(key)).uploadId : null
      return {
        id: randomId(),
        releaseId,
        name: file.name,
        platform: file.platform,
        format: app.format,
        kind: file.kind,
        key,
        size: file.size,
        sha256: file.sha256,
        executable: file.executable ?? null,
        uploadId,
      }
    }),
  )
  await db.batch([
    db.insert(schema.release).values({
      id: releaseId,
      appId: app.id,
      version,
      tag: body.tag,
      commit: publisher.origin === "oidc" ? publisher.commit : (body.commit ?? null),
      runUrl: publisher.origin === "oidc" ? publisher.runUrl : null,
      workflow: publisher.origin === "oidc" ? publisher.workflow : null,
      origin: publisher.origin,
      notes: body.notes,
      manifest: body.schelf_toml,
      permissions: declaredPermissions(manifest, body.permissions_toml),
      requires: manifest.requires,
      status: "uploading",
    }),
    db.insert(schema.artifact).values(artifacts),
  ])

  const upload = await issueUploadToken(releaseId)
  return {
    release: releaseId,
    app: app.id,
    version,
    status: "uploading",
    dashboard: dashboardUrl(app.id, releaseId),
    upload_token: upload.token,
    expires: upload.expires.toISOString(),
    files: artifacts.map((artifact) => ({
      name: artifact.name,
      url: `${env.PUBLIC_URL}/api/v1/publish/${releaseId}/files/${encodeURIComponent(artifact.name)}`,
      parts: partsFor(artifact.size),
      part_size: PART_SIZE,
    })),
  }
}
