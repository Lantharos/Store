import {
  type ArtifactKind,
  compareVersions,
  type HostedRelease,
  type Platform,
  SHIPPED_STATUSES,
} from "@schelf/protocol"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { blockedReleaseIds, fileUrl } from "../signing/records.ts"

const CACHE_SECONDS = 60

async function loadReleases(appId: string, channel: string): Promise<HostedRelease[]> {
  const [releases, blocked] = await Promise.all([
    db
      .select()
      .from(schema.release)
      .where(
        and(
          eq(schema.release.appId, appId),
          eq(schema.release.channel, channel),
          inArray(schema.release.status, [...SHIPPED_STATUSES]),
        ),
      )
      .orderBy(desc(schema.release.approvedAt))
      .limit(20),
    blockedReleaseIds([appId]),
  ])
  if (blocked.apps.has(appId)) return []
  const open = releases.filter((release) => !blocked.releases.has(release.id))
  const artifacts = open.length
    ? await db
        .select()
        .from(schema.artifact)
        .where(
          inArray(
            schema.artifact.releaseId,
            open.map((release) => release.id),
          ),
        )
    : []
  return open.map((release) => ({
    version: release.version,
    channel: release.channel,
    published: (release.approvedAt ?? release.createdAt).toISOString(),
    notes: release.notes,
    rollout: release.rolloutPercent,
    bridge: release.bridge,
    updater: release.updater,
    files: artifacts
      .filter((artifact) => artifact.releaseId === release.id)
      .map((artifact) => ({
        part: artifact.part,
        platform: artifact.platform as Platform,
        kind: artifact.kind as ArtifactKind,
        name: artifact.name,
        url: fileUrl(artifact.key),
        size: artifact.size,
        sha256: artifact.sha256,
        sha512: artifact.sha512,
        signature: artifact.signature,
        attestation: artifact.attestationUrl,
        blockmapSize: artifact.blockmapSize,
      })),
  }))
}

export async function hostedReleases(appId: string, channel: string) {
  const key = new Request(`https://hosting.schelf.internal/releases/${encodeURIComponent(appId)}/${channel}`)
  const cached = await caches.default.match(key)
  if (cached) return cached.json<HostedRelease[]>()
  const releases = await loadReleases(appId, channel)
  await caches.default.put(
    key,
    Response.json(releases, { headers: { "cache-control": `max-age=${CACHE_SECONDS}` } }),
  )
  return releases
}

export async function linkReleases(appId: string, route: string[]) {
  const lists = await Promise.all(route.toReversed().map((channel) => hostedReleases(appId, channel)))
  return lists.flat()
}

/** A feed can't see the version asking, and electron-updater takes a lower one from a channel it's set to. */
export async function feedReleases(appId: string, route: string[]) {
  const releases = await linkReleases(appId, route)
  return route.length > 1
    ? releases.sort((left, right) => compareVersions(right.version, left.version))
    : releases
}
