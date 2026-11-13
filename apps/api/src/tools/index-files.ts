import { env } from "cloudflare:workers"
import {
  channelNow,
  INVITED_PREFIX,
  offeredIn,
  type Platform,
  paths,
  type ToolEntry,
  type ToolIndex,
  type ToolKind,
  toolAddress,
  toolsOf,
  type Unstamped,
} from "@schelf/protocol"
import { partPlan } from "../publishing/parts.ts"
import { type AppRecord, type AppRow, fileUrl } from "../signing/records.ts"
import { writeSigned } from "../signing/write.ts"
import { otherHolder, shortNames, shortState } from "./registry.ts"

function toolReleases(record: AppRecord, entry: ToolEntry, invitedTo: string | undefined) {
  const plan = partPlan(record.app)
  return record.releases
    .filter(
      ({ release }) =>
        !release.bridge && (!record.inviteOnly.has(release.channel) || release.channel === invitedTo),
    )
    .map(({ release, artifacts }) => ({
      release,
      files: artifacts.filter((artifact) => artifact.part === entry.part && offeredIn(plan, artifact)),
    }))
    .filter(({ files }) => files.length)
}

export function toolDocument(
  record: AppRecord,
  entry: ToolEntry,
  short: boolean,
  invitedTo?: string,
): Unstamped<ToolIndex> {
  const ended = record.endedChannels
  return {
    version: 1,
    generated: new Date().toISOString(),
    name: entry.name,
    address: toolAddress(record.publisher.slug, entry.name),
    short,
    project: {
      id: record.app.id,
      address: `${record.publisher.slug}/${record.app.slug}`,
      part: entry.part,
    },
    publisher: record.publisher,
    distribution: record.app.distribution,
    repository: record.app.repository,
    ...(ended.size
      ? {
          ended_channels: Object.fromEntries(
            [...ended.keys()].map((name) => [name, channelNow(name, ended)]),
          ),
        }
      : {}),
    releases: toolReleases(record, entry, invitedTo).map(({ release, files }) => ({
      version: release.version,
      channel: release.channel,
      published: (release.approvedAt ?? release.createdAt).toISOString(),
      rollout: { percent: release.rolloutPercent, paused: release.rolloutPaused },
      files: files.map((file) => ({
        platform: file.platform as Platform,
        kind: file.kind as ToolKind,
        url: fileUrl(file.key),
        size: file.size,
        sha256: file.sha256,
        attestation: file.attestationUrl,
      })),
    })),
  }
}

async function listKeys(prefix: string) {
  return (await env.BUCKET.list({ prefix })).objects.map((object) => object.key)
}

const invitedToolPrefix = (publisher: string, name: string) =>
  `${INVITED_PREFIX}index/v1/tools/${publisher}/${name}/`

const signedPair = (key: string) => [key, paths.signature(key)]

export async function writeToolIndexes(record: AppRecord) {
  const entries = toolsOf(record.app)
  const owner = { id: record.app.publisherId, verified: record.publisher.verified }
  const rows = await shortNames(entries.map((entry) => entry.name))
  for (const entry of entries) {
    const row = rows.get(entry.name)
    const short = shortState(entry.name, owner, row) === "resolves"
    await writeSigned(paths.tool(record.publisher.slug, entry.name), toolDocument(record, entry, short))
    if (short) await writeSigned(paths.shortTool(entry.name), toolDocument(record, entry, true))
    else if (row?.publisherId === owner.id) await env.BUCKET.delete(signedPair(paths.shortTool(entry.name)))
    const kept = new Set<string>()
    for (const channel of record.inviteOnly) {
      const key = paths.invitedTool(record.publisher.slug, entry.name, channel)
      await writeSigned(key, toolDocument(record, entry, short, channel))
      for (const each of signedPair(key)) kept.add(each)
    }
    const stale = (await listKeys(invitedToolPrefix(record.publisher.slug, entry.name))).filter(
      (key) => !kept.has(key),
    )
    if (stale.length) await env.BUCKET.delete(stale)
  }
}

export async function removeToolIndexes(
  app: Pick<AppRow, "id" | "publisherId">,
  publisherSlug: string,
  entries: ToolEntry[],
) {
  const rows = await shortNames(entries.map((entry) => entry.name))
  for (const entry of entries) {
    if (await otherHolder(app, entry.name)) continue
    const keys = [
      ...signedPair(paths.tool(publisherSlug, entry.name)),
      ...(rows.get(entry.name)?.publisherId === app.publisherId
        ? signedPair(paths.shortTool(entry.name))
        : []),
      ...(await listKeys(invitedToolPrefix(publisherSlug, entry.name))),
    ]
    await env.BUCKET.delete(keys)
  }
}

export async function removePublisherToolIndexes(publisherSlug: string) {
  const keys = (
    await Promise.all(
      [`index/v1/tools/${publisherSlug}/`, `${INVITED_PREFIX}index/v1/tools/${publisherSlug}/`].map(listKeys),
    )
  ).flat()
  if (keys.length) await env.BUCKET.delete(keys)
}
