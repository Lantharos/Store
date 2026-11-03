import {
  type AppIndex,
  accessOf,
  type CatalogEntry,
  type IndexedRelease,
  type Platform,
  type PlatformRelease,
  parseSabineVersion,
  type SabineFeed,
  sabineTarget,
} from "@schelf/protocol"
import {
  type AppRecord,
  englishListing,
  fileUrl,
  type IndexedArtifact,
  mediaUrl,
  type ReleaseRow,
} from "./records.ts"

function accessFor(record: AppRecord, release: ReleaseRow | undefined) {
  if (record.app.format === "sabine") return "full"
  return accessOf(release ? release.permissions : null)
}

function updatedAt(record: AppRecord) {
  return (record.releases[0]?.release.approvedAt ?? record.app.createdAt).toISOString()
}

export function catalogEntry(record: AppRecord): CatalogEntry {
  const english = englishListing(record)
  const platforms: Partial<Record<Platform, PlatformRelease>> = {}
  for (const { release, artifacts } of record.releases) {
    for (const artifact of artifacts) {
      const target = artifact.platform as Platform
      platforms[target] ??= {
        version: release.version,
        format: record.app.format,
        size: artifact.size,
        rollout: release.rolloutPercent,
      }
    }
  }
  return {
    id: record.app.id,
    kind: record.app.kind,
    name: english.name,
    summary: english.summary,
    icon: mediaUrl(record.meta?.iconKey),
    categories: record.meta?.categories ?? [],
    developer: record.developer,
    platforms,
    access: accessFor(record, record.releases[0]?.release),
    updated: updatedAt(record),
    installs_30d: record.installs30d,
  }
}

function indexedRelease(
  record: AppRecord,
  release: ReleaseRow,
  artifacts: IndexedArtifact[],
): IndexedRelease {
  return {
    version: release.version,
    channel: release.channel,
    published: (release.approvedAt ?? release.createdAt).toISOString(),
    notes: release.notes,
    rollout: { percent: release.rolloutPercent, paused: release.rolloutPaused },
    permissions: release.permissions,
    access: accessFor(record, release),
    requires: release.requires,
    provenance: {
      origin: release.origin === "oidc" ? "github-actions" : "developer",
      repository: record.app.repository,
      workflow: release.workflow,
      tag: release.tag,
      commit: release.commit,
      run: release.runUrl,
    },
    artifacts: artifacts.map((artifact) => ({
      platform: artifact.platform as Platform,
      format: record.app.format,
      kind: artifact.kind as IndexedRelease["artifacts"][number]["kind"],
      url: fileUrl(artifact.key),
      size: artifact.size,
      sha256: artifact.sha256,
      executable: artifact.executable,
      deltas: artifact.deltas.map((delta) => ({
        from: delta.from,
        url: fileUrl(delta.key),
        size: delta.size,
        sha256: delta.sha256,
      })),
    })),
  }
}

export function appIndex(record: AppRecord): AppIndex {
  return {
    version: 1,
    generated: new Date().toISOString(),
    id: record.app.id,
    kind: record.app.kind,
    format: record.app.format,
    developer: record.developer,
    listing: Object.fromEntries(
      record.listing.map((entry) => [
        entry.locale,
        {
          name: entry.name,
          summary: entry.summary,
          description: entry.description,
          keywords: entry.keywords,
        },
      ]),
    ),
    icon: mediaUrl(record.meta?.iconKey),
    screenshots: record.screenshots.map((shot) => ({
      platform: shot.platform as Platform | null,
      url: fileUrl(shot.key),
      width: shot.width,
      height: shot.height,
      caption: shot.caption,
    })),
    categories: record.meta?.categories ?? [],
    homepage: record.meta?.homepage ?? null,
    support: record.meta?.support ?? null,
    privacy_url: record.meta?.privacyUrl ?? null,
    content_rating: record.meta?.contentRating ?? null,
    brand_color: record.meta?.brandColor ?? null,
    licence: record.app.licence,
    repository: record.app.repository,
    distribution: record.app.distribution,
    releases: record.releases.map(({ release, artifacts }) => indexedRelease(record, release, artifacts)),
  }
}

export function sabineFeeds(record: AppRecord): Map<string, SabineFeed> {
  const feeds = new Map<string, SabineFeed>()
  if (record.app.format !== "sabine") return feeds
  for (const { release, artifacts } of record.releases) {
    if (feeds.has(release.channel)) continue
    feeds.set(release.channel, {
      schema: 1,
      app_id: record.app.id,
      version: release.version,
      channel: release.channel,
      published_at: String(Math.floor((release.approvedAt ?? release.createdAt).getTime() / 1000)),
      requires_sabine: parseSabineVersion(release.requires.sabine ?? "0.0"),
      artifacts: Object.fromEntries(
        artifacts.map((artifact) => {
          const kind = artifact.kind as SabineFeed["artifacts"][string]["kind"]
          return [
            sabineTarget(artifact.platform, kind, kind !== "archive"),
            { url: fileUrl(artifact.key), sha256: artifact.sha256, kind, executable: artifact.executable },
          ]
        }),
      ),
      rollout: release.rolloutPercent,
      signature: "",
    })
  }
  return feeds
}
