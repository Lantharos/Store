import {
  type AppSettings,
  channelNow,
  DEFAULT_LOCALE,
  endedChannelsOf,
  rollsOutGradually,
} from "@schelf/protocol"
import { count, desc, eq } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { linkRoot } from "../../domains/links.ts"
import { domainOf, domainState } from "../../domains/state.ts"
import { projectLinks } from "../../hosting/addresses.ts"
import { iso } from "../../lib/time.ts"
import { type AppRow, fileUrl, installsSince, mediaUrl } from "../../signing/records.ts"
import { setupFiles } from "./setup.ts"

export async function appSettings(app: AppRow): Promise<AppSettings> {
  const [
    listings,
    meta,
    screenshots,
    publishers,
    tokens,
    [latest],
    installs,
    owner,
    channels,
    counts,
    switches,
    domain,
  ] = await Promise.all([
    db.select().from(schema.listing).where(eq(schema.listing.appId, app.id)),
    db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, app.id) }),
    db
      .select()
      .from(schema.screenshot)
      .where(eq(schema.screenshot.appId, app.id))
      .orderBy(schema.screenshot.position),
    db.select().from(schema.trustedPublisher).where(eq(schema.trustedPublisher.appId, app.id)),
    db
      .select()
      .from(schema.token)
      .where(eq(schema.token.appId, app.id))
      .orderBy(desc(schema.token.createdAt)),
    db
      .select({ version: schema.release.version, status: schema.release.status })
      .from(schema.release)
      .where(eq(schema.release.appId, app.id))
      .orderBy(desc(schema.release.createdAt))
      .limit(1),
    installsSince([app.id], 7),
    db.query.publisher.findFirst({ where: eq(schema.publisher.id, app.publisherId) }),
    db.select().from(schema.channel).where(eq(schema.channel.appId, app.id)),
    db
      .select({ channel: schema.release.channel, releases: count() })
      .from(schema.release)
      .where(eq(schema.release.appId, app.id))
      .groupBy(schema.release.channel),
    db
      .select()
      .from(schema.updaterSwitch)
      .where(eq(schema.updaterSwitch.appId, app.id))
      .orderBy(desc(schema.updaterSwitch.createdAt)),
    domainOf(app.id),
  ])
  const publisherSlug = owner!.slug
  const releasesIn = new Map(counts.map((row) => [row.channel, row.releases]))
  const channelNames = [...new Set(["stable", ...channels.map((row) => row.name)])]
  const ended = endedChannelsOf(channels)
  const english = listings.find((entry) => entry.locale === DEFAULT_LOCALE)
  const publisher = publishers[0]
  return {
    app: {
      id: app.id,
      slug: app.slug,
      publisher: app.publisherId,
      publisher_slug: publisherSlug,
      visibility: app.visibility,
      listing_requested: app.listingRequestedAt !== null,
      updater: app.updater,
      kind: app.kind,
      format: app.format,
      name: english?.name ?? app.id,
      icon: mediaUrl(meta?.iconKey),
      art: app.kind === "extension" ? mediaUrl(screenshots[0]?.key) : null,
      status: app.status,
      version: latest?.version ?? null,
      release_status: latest?.status ?? null,
      installs_7d: installs.get(app.id) ?? 0,
      repository: app.repository,
      licence: app.licence,
      distribution: app.distribution,
      page_indexed: app.pageIndexed,
      latest_follows_rollout: app.latestFollowsRollout,
      platforms: app.platforms,
      parts: app.parts,
      privacy: app.privacy,
      domain: domain ? domainState(domain) : null,
      created_at: app.createdAt.toISOString(),
    },
    links: projectLinks(
      app,
      publisherSlug,
      [
        ...new Set(
          [app.updater, ...switches.map((row) => row.fromUpdater)].filter((updater) => updater !== null),
        ),
      ],
      await linkRoot(app, publisherSlug),
    ),
    channels: channelNames.map((name) => ({
      name,
      keep: channels.find((row) => row.name === name)?.keep ?? null,
      gradual: rollsOutGradually(name, channels.find((row) => row.name === name)?.gradual ?? null),
      releases: releasesIn.get(name) ?? 0,
      ended_into: ended.has(name) ? channelNow(name, ended) : null,
      invite_only: channels.find((row) => row.name === name)?.inviteOnly ?? false,
    })),
    switches: switches.map((row) => ({
      id: row.id,
      from: row.fromUpdater,
      to: row.toUpdater,
      from_format: row.fromFormat,
      to_format: row.toFormat,
      started_at: row.createdAt.toISOString(),
      first_release: row.firstReleaseId,
      bridge_release: row.bridgeReleaseId,
      completed_at: iso(row.completedAt),
    })),
    listing: Object.fromEntries(
      listings.map((entry) => [
        entry.locale,
        {
          name: entry.name,
          summary: entry.summary,
          description: entry.description,
          keywords: entry.keywords,
        },
      ]),
    ),
    config: app.configFiles ?? { schelf_toml: null, listing_toml: null, applied_at: null },
    meta: {
      icon: mediaUrl(meta?.iconKey),
      categories: meta?.categories ?? [],
      homepage: meta?.homepage ?? null,
      support: meta?.support ?? null,
      privacy_url: meta?.privacyUrl ?? null,
      content_rating: meta?.contentRating ?? null,
      brand_color: meta?.brandColor ?? null,
    },
    screenshots: screenshots.map((shot) => ({
      id: shot.id,
      position: shot.position,
      platform: shot.platform as never,
      url: fileUrl(shot.key),
      width: shot.width,
      height: shot.height,
      caption: shot.caption,
    })),
    trusted_publishers: publishers.map((row) => ({
      id: row.id,
      owner_id: row.ownerId,
      repository_id: row.repositoryId,
      repository: row.repository,
      workflow: row.workflow,
      environment: row.environment,
      ref: row.ref,
      created_at: row.createdAt.toISOString(),
    })),
    tokens: tokens.map((row) => ({
      id: row.id,
      name: row.name,
      last_used_at: iso(row.lastUsedAt),
      expires_at: row.expiresAt.toISOString(),
      revoked_at: iso(row.revokedAt),
    })),
    setup: setupFiles(
      app,
      publisherSlug,
      publisher?.workflow ?? ".github/workflows/schelf.yml",
      publisher?.environment ?? null,
      channels,
    ),
  }
}
