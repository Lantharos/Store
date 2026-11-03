import {
  DEFAULT_LOCALE,
  detect,
  electronFeed,
  electronFeedName,
  type HostedFile,
  type HostedRelease,
  type LinkOptions,
  latestRelease,
  linkTarget,
  type ProjectDownloads,
  type ProjectFile,
  resolveLink,
  STABLE,
  tauriFeed,
  updaterRelease,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { linkBase, pageUrl } from "./addresses.ts"
import { hostedReleases } from "./releases.ts"

const SHORT_CACHE = "public, max-age=60"
const CHANNEL = /^@([a-z][a-z0-9-]{0,19})$/

type Project = NonNullable<Awaited<ReturnType<typeof findProject>>>

async function findProject(publisherSlug: string, slug: string) {
  const [row] = await db
    .select({ app: schema.app, name: schema.listing.name })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(and(eq(schema.publisher.slug, publisherSlug), eq(schema.app.slug, slug)))
  return row && { ...row.app, name: row.name ?? row.app.slug, publisherSlug }
}

function text(body: string, status = 200, type = "text/plain; charset=utf-8", cache = SHORT_CACHE) {
  return new Response(body, {
    status,
    headers: { "content-type": type, "cache-control": cache, "access-control-allow-origin": "*" },
  })
}

function json(body: unknown, cache = SHORT_CACHE) {
  return text(JSON.stringify(body), 200, "application/json", cache)
}

function redirect(url: string, varies: boolean) {
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": varies ? "no-store" : SHORT_CACHE },
  })
}

const notFound = (message = "Not found") => text(message, 404)

function sums(files: HostedFile[]) {
  return text(files.map((file) => `${file.sha256}  ${file.name}\n`).join(""))
}

function projectFiles(project: Project, channel: string, releases: HostedRelease[], options: LinkOptions) {
  const platforms = [...new Set(releases.flatMap((release) => release.files.map((file) => file.platform)))]
  const base = linkBase(project, project.publisherSlug, channel)
  const files: ProjectFile[] = []
  for (const platform of platforms) {
    const resolved = resolveLink(releases, platform, undefined, options)
    if (!resolved || resolved.file.platform !== platform) continue
    for (const file of resolved.release.files.filter((each) => each.platform === platform))
      files.push({
        version: resolved.release.version,
        name: file.name,
        platform: file.platform,
        kind: file.kind,
        size: file.size,
        sha256: file.sha256,
        url: file.url,
        link: `${base}/latest/${platform}/${file.kind}`,
        attestation: file.attestation,
      })
  }
  return files
}

function visitorTarget(request: Request) {
  const system = detect(
    request.headers.get("user-agent") ?? "",
    request.headers.get("sec-ch-ua-platform"),
    request.headers.get("sec-ch-ua-arch"),
  )
  return linkTarget(system)
}

export async function serveProject(request: Request, segments: string[]) {
  const [publisherSlug, slug, ...path] = segments
  const project = await findProject(publisherSlug!, slug!)
  if (
    !project ||
    project.status === "draft" ||
    project.status === "in-review" ||
    project.status === "delisted"
  )
    return notFound("There's no project here")
  if (project.status === "pulled") return text("This project was pulled from Schelf", 410)
  const channelMatch = path[0] ? CHANNEL.exec(path[0]) : null
  const channel = channelMatch ? channelMatch[1]! : STABLE
  if (channelMatch) path.shift()

  const releases = await hostedReleases(project.id, channel)
  const options: LinkOptions = { followRollout: project.latestFollowsRollout, draw: Math.random() }
  const varies = (release: HostedRelease) => options.followRollout && release.rollout < 100
  const [first, second, third, fourth] = path

  if (first === "latest" && !second) {
    const target = visitorTarget(request)
    const resolved = target ? resolveLink(releases, target, undefined, options) : undefined
    return resolved
      ? redirect(resolved.file.url, varies(resolved.release))
      : redirect(pageUrl(project, project.publisherSlug), false)
  }
  if (first === "latest" && second === "SHA256SUMS") {
    const latest = latestRelease(releases, options)
    return latest ? sums(latest.files) : notFound()
  }
  if (first === "latest") {
    const resolved = resolveLink(releases, second!, third, options)
    return resolved
      ? redirect(resolved.file.url, varies(resolved.release))
      : notFound(`Nothing for ${second} yet`)
  }
  if (first === "v" && second) {
    const release = releases.find((candidate) => candidate.version === second)
    if (!release) return notFound(`There's no ${second} on ${channel}`)
    if (third === "SHA256SUMS") return sums(release.files)
    if (!third) return json(release)
    const resolved = resolveLink([{ ...release, bridge: false, rollout: 100 }], third, fourth, options)
    return resolved ? redirect(resolved.file.url, false) : notFound(`${second} has nothing for ${third}`)
  }
  if (first === "latest.json" && !second) {
    const files = projectFiles(project, channel, releases, options)
    const newest = latestRelease(releases, options)
    if (!newest) return notFound("Nothing is out yet")
    return json(
      {
        project: `${project.publisherSlug}/${project.slug}`,
        name: project.name,
        channel,
        version: newest.version,
        published: newest.published,
        notes: newest.notes,
        page: pageUrl(project, project.publisherSlug),
        files,
      } satisfies ProjectDownloads,
      options.followRollout ? "no-store" : SHORT_CACHE,
    )
  }
  if (first === "tauri.json" && !second) {
    const release = updaterRelease(releases, "tauri", options)
    const feed = release && tauriFeed(release)
    return feed
      ? json(feed, options.followRollout ? "no-store" : SHORT_CACHE)
      : new Response(null, { status: 204 })
  }
  if (first && !second && electronFeedName(first)) {
    const named = electronFeedName(first)!
    const lineReleases =
      named.channel === channel ? releases : await hostedReleases(project.id, named.channel)
    const release = lineReleases.find((candidate) => candidate.updater === "electron")
    const feed = release && electronFeed(release, first)
    return feed ? text(feed, 200, "text/yaml; charset=utf-8") : notFound(`There's no ${first} here`)
  }
  return notFound()
}

export const DOWNLOAD_ROOTS = new Set(["apps", "index", "trust", "sabine", "media", "private"])

export function isProjectPath(segments: string[]) {
  return segments.length >= 2 && !DOWNLOAD_ROOTS.has(segments[0]!)
}
