import { env } from "cloudflare:workers"
import {
  channelFromVersion,
  EXTENSION_MANIFEST,
  type Format,
  fromBase64,
  manifestName,
  PART_SIZE,
  type PublishFile,
  type PublishRequest,
  type PublishResponse,
  parseConfig,
  partsFor,
  paths,
  type Requires,
  readExtensionAccess,
  readLuftMinimum,
  readPermissions,
  SCHELF_TOML,
  type SchelfToml,
  schelfToml,
  splitProjectPath,
} from "@schelf/protocol"
import { and, eq, sql } from "drizzle-orm"
import { db, insertRows, schema } from "../db/client.ts"
import { ensureChannel } from "../hosting/channels.ts"
import { refuseEnded } from "../hosting/ended.ts"
import { limitManualUploads } from "../hosting/limits.ts"
import { releaseLine } from "../hosting/switches.ts"
import { inviteOnlyChannels } from "../invited/channels.ts"
import { fail, failConfig } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { acceptingSubmissions } from "../ops/events.ts"
import type { AppRow } from "../signing/records.ts"
import { sortIntoParts } from "./parts.ts"
import { identifyPublisher, type Publisher } from "./publisher.ts"
import { issueUploadToken } from "./upload-token.ts"

const RETRYABLE = new Set(["uploading", "failed"])

function readManifest(text: string): SchelfToml {
  const read = parseConfig(SCHELF_TOML, schelfToml, text)
  if (!read.ok) failConfig(read.issues)
  return read.value
}

function declared(manifest: SchelfToml, text: string | undefined) {
  if (manifest.kind === "extension") {
    if (!manifest.permissions || text === undefined)
      fail(
        422,
        `An extension's schelf.toml sets permissions = "${EXTENSION_MANIFEST}"; send its contents too`,
      )
    return {
      permissions: null,
      extensionAccess: readExtensionAccess(text),
      luftMinimum: readLuftMinimum(text),
    }
  }
  if (!manifest.permissions) return { permissions: null, extensionAccess: null, luftMinimum: null }
  if (text === undefined) fail(422, `schelf.toml names ${manifest.permissions}; send its contents too`)
  return { permissions: readPermissions(text), extensionAccess: null, luftMinimum: null }
}

export async function appById(id: string) {
  return db.query.app.findFirst({ where: sql`lower(${schema.app.id}) = lower(${id})` })
}

export async function appByProject(publisherSlug: string, slug: string) {
  const [row] = await db
    .select({ app: schema.app })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .where(and(eq(schema.publisher.slug, publisherSlug), eq(schema.app.slug, slug)))
  return row?.app
}

export function appOfManifest(manifest: SchelfToml) {
  if (manifest.id) return appById(manifest.id)
  const path = splitProjectPath(manifest.project!)!
  return appByProject(path.publisher, path.project)
}

async function clearAbandoned(app: AppRow, version: string) {
  const existing = await db.query.release.findFirst({
    where: and(eq(schema.release.appId, app.id), eq(schema.release.version, version)),
  })
  if (!existing) return
  if (!RETRYABLE.has(existing.status))
    fail(
      409,
      `${version} was already published on ${existing.channel}; promote it to another channel instead`,
    )
  const artifacts = await db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, existing.id))
  await Promise.all(
    artifacts.flatMap((artifact) => [
      env.BUCKET.delete(paths.blockmap(artifact.key)),
      artifact.uploadId && !artifact.uploadedAt
        ? env.BUCKET.resumeMultipartUpload(artifact.key, artifact.uploadId).abort()
        : env.BUCKET.delete(artifact.key),
    ]),
  )
  await db.delete(schema.release).where(eq(schema.release.id, existing.id))
}

export function dashboardUrl(app: string, release: string) {
  return `${env.PUBLIC_URL}/dashboard/apps/${app}/releases/${release}`
}

export async function publishable(app: AppRow) {
  if (app.status === "pulled") fail(403, `${app.id} was pulled from the store`)
  if (app.status === "deleted") fail(403, `${app.id} was deleted by its publisher`)
  const owner = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, app.publisherId) })
  if (owner?.status !== "active") fail(403, `${owner?.name ?? "This publisher"} can't publish right now`)
  if (!(await acceptingSubmissions())) fail(503, "schelf.store isn't taking new releases for a little while")
  return owner
}

export interface NewRelease {
  app: AppRow
  publisher: Publisher
  version: string
  commit: string | null
  notes: string
  manifest: string
  format: Format
  declared: ReturnType<typeof declared>
  requires: Requires
  channel: string | undefined
  bridge: boolean
  files: PublishFile[]
}

export async function createRelease(input: NewRelease): Promise<PublishResponse> {
  const { app, publisher, version } = input
  const names = new Set(input.files.map((file) => file.name))
  if (names.size !== input.files.length) fail(422, "Two files have the same name")
  const files = sortIntoParts(app, input.files)
  const line = await releaseLine(app, input.format, input.bridge)
  const channel = input.channel ?? channelFromVersion(version)
  await refuseEnded(app.id, channel)
  if (publisher.origin === "manual") await limitManualUploads(app.publisherId)
  await clearAbandoned(app, version)
  await ensureChannel(app.id, channel)
  const invited = (await inviteOnlyChannels(app.id)).has(channel)
  const keyOf = invited ? paths.invitedArtifact : paths.artifact

  const releaseId = randomId()
  const artifacts = await Promise.all(
    files.map(async (file) => {
      const key = keyOf(app.id, version, file.platform, file.name)
      const parts = partsFor(file.size)
      const uploadId = parts > 1 ? (await env.BUCKET.createMultipartUpload(key)).uploadId : null
      if (file.blockmap) await env.BUCKET.put(paths.blockmap(key), fromBase64(file.blockmap))
      return {
        id: randomId(),
        releaseId,
        name: file.name,
        part: file.part,
        platform: file.platform,
        format: file.part ? ("files" as const) : input.format,
        kind: file.kind,
        key,
        size: file.size,
        sha256: file.sha256,
        signature: file.signature ?? null,
        executable: file.executable ?? null,
        blockmapSize: file.blockmap_size ?? null,
        uploadId,
      }
    }),
  )
  const oidc = publisher.origin === "oidc" ? publisher : null
  await db.batch([
    db.insert(schema.release).values({
      id: releaseId,
      appId: app.id,
      version,
      channel,
      ref: oidc?.ref ?? null,
      commit: oidc?.commit ?? input.commit,
      runUrl: oidc?.runUrl ?? null,
      workflow: oidc?.workflow ?? null,
      origin: publisher.origin,
      format: input.format,
      updater: line.updater,
      bridge: line.bridge,
      notes: input.notes,
      manifest: input.manifest,
      ...input.declared,
      requires: input.requires,
      status: "uploading",
    }),
    ...insertRows(schema.artifact, artifacts),
  ])

  const upload = await issueUploadToken(releaseId)
  return {
    release: releaseId,
    app: app.id,
    version,
    channel,
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

export async function startRelease(
  credential: string | null,
  body: PublishRequest,
): Promise<PublishResponse> {
  const manifest = readManifest(body.schelf_toml)
  const app = await appOfManifest(manifest)
  if (!app)
    fail(
      404,
      `${manifestName(manifest)} isn't on schelf.store yet; add it in the dashboard or run schelf init`,
    )
  if (app.kind !== manifest.kind)
    fail(422, `${app.id} is registered as an ${app.kind}, not an ${manifest.kind}`)
  const publisher = await identifyPublisher(credential, app)
  await publishable(app)
  return createRelease({
    app,
    publisher,
    version: body.version,
    commit: body.commit ?? null,
    notes: body.notes,
    manifest: body.schelf_toml,
    format: manifest.format,
    declared: declared(manifest, body.permissions_toml),
    requires: manifest.requires,
    channel: body.channel,
    bridge: body.bridge,
    files: body.files,
  })
}
