import {
  type AppIndex,
  accessOf,
  type CatalogEntry,
  channelNow,
  channelPath,
  type Format,
  type IndexedRelease,
  type MirrorEntry,
  offeredIn,
  type Platform,
  type PlatformRelease,
  parseSabineVersion,
  type SabineFeed,
  STABLE,
  sabineTarget,
  type Unstamped,
} from "@schelf/protocol"
import type { schema } from "../db/client.ts"
import { partPlan } from "../publishing/parts.ts"
import { runsInShell } from "../releases/shell-files.ts"
import {
  type AppRecord,
  englishListing,
  fileUrl,
  type IndexedArtifact,
  mediaUrl,
  type ReleaseRow,
} from "./records.ts"

function accessFor(record: AppRecord, release: ReleaseRow | undefined) {
  if ((release?.format ?? record.app.format) === "sabine") return "full"
  return accessOf(release ? release.permissions : null)
}

function updatedAt(record: AppRecord) {
  return (record.releases[0]?.release.approvedAt ?? record.app.createdAt).toISOString()
}

function appFiles(record: AppRecord, artifacts: IndexedArtifact[]) {
  const plan = partPlan(record.app)
  return artifacts.filter((artifact) => artifact.part === null && offeredIn(plan, artifact))
}

const appReleases = (record: AppRecord) =>
  record.releases.map(({ release, artifacts }) => ({ release, artifacts: appFiles(record, artifacts) }))

const indexable = (record: AppRecord) => appReleases(record).filter(({ release }) => !release.bridge)
const stable = (record: AppRecord) => indexable(record).filter(({ release }) => release.channel === STABLE)

export function catalogEntry(record: AppRecord): CatalogEntry {
  const english = englishListing(record)
  const platforms: Partial<Record<Platform, PlatformRelease>> = {}
  for (const { release, artifacts } of stable(record)) {
    for (const artifact of artifacts) {
      const target = artifact.platform as Platform
      platforms[target] ??= {
        version: release.version,
        format: artifact.format as Format,
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
    art: record.app.kind === "extension" ? mediaUrl(record.screenshots[0]?.key) : null,
    categories: record.meta?.categories ?? [],
    publisher: record.publisher,
    platforms,
    access: accessFor(record, stable(record)[0]?.release),
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
    extension: release.extensionAccess,
    access: accessFor(record, release),
    requires: release.luftMinimum ? { ...release.requires, luft: release.luftMinimum } : release.requires,
    ...(record.app.kind === "extension" && {
      runs_in_shell: runsInShell(release, artifacts, record.publisher.verified),
    }),
    provenance: {
      origin: release.origin === "oidc" ? "github-actions" : "developer",
      repository: record.app.repository,
      workflow: release.workflow,
      ref: release.ref,
      commit: release.commit,
      run: release.runUrl,
    },
    artifacts: artifacts.map((artifact) => ({
      platform: artifact.platform as Platform,
      format: artifact.format as Format,
      kind: artifact.kind as IndexedRelease["artifacts"][number]["kind"],
      url: fileUrl(artifact.key),
      size: artifact.size,
      sha256: artifact.sha256,
      attestation: artifact.attestationUrl,
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

export function appIndex(record: AppRecord): Unstamped<AppIndex> {
  return {
    version: 1,
    generated: new Date().toISOString(),
    id: record.app.id,
    kind: record.app.kind,
    format: record.app.format,
    publisher: record.publisher,
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
    ...(record.app.replacedBy
      ? { replaced_by: { id: record.app.replacedBy, note: record.app.replacedNote ?? "" } }
      : {}),
    ...(record.endedChannels.size
      ? {
          ended_channels: Object.fromEntries(
            [...record.endedChannels.keys()].map((name) => [name, channelNow(name, record.endedChannels)]),
          ),
        }
      : {}),
    releases: indexable(record).map(({ release, artifacts }) => indexedRelease(record, release, artifacts)),
  }
}

function endedFeeds(record: AppRecord, feeds: Map<string, SabineFeed>) {
  return [...record.endedChannels.keys()].flatMap((name) => {
    const source = channelPath(name, record.endedChannels)
      .toReversed()
      .find((channel) => feeds.has(channel))
    return source ? [[name, { ...feeds.get(source)!, channel: name }] as const] : []
  })
}

export function sabineFeeds(record: AppRecord): Map<string, SabineFeed> {
  const feeds = new Map<string, SabineFeed>()
  for (const { release, artifacts } of appReleases(record)) {
    if (release.updater !== "sabine" || feeds.has(release.channel)) continue
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
  return new Map([...feeds, ...endedFeeds(record, feeds)])
}

export function mirrorCatalogEntry(row: typeof schema.mirrorApp.$inferSelect): MirrorEntry {
  const base = {
    id: row.id,
    kind: "app" as const,
    name: row.name,
    summary: row.summary,
    icon: row.icon,
    categories: row.categories,
    publisher: { name: row.publisher, verified: row.verified },
    updated: row.updatedAt.toISOString(),
    installs_30d: row.installs30d,
    rank: row.rank,
  }
  return row.origin === "flathub"
    ? { ...base, origin: "flathub", flathub: row.ref }
    : { ...base, origin: "fedora", package: row.ref }
}
