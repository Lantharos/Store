import {
  channelPath,
  DEFAULT_LOCALE,
  detect,
  electronFeed,
  electronFeedName,
  endedChannelsOf,
  type HostedFile,
  type HostedRelease,
  type LinkOptions,
  latestRelease,
  linkTarget,
  offeredReleases,
  type ProjectDownloads,
  partNames,
  partReleases,
  partUpdater,
  resolveLink,
  STABLE,
  tauriFeed,
  updaterRelease,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { linkRoot } from "../../domains/links.ts"
import { channelsOpenTo, shutOut } from "../../invited/access.ts"
import { signReleases } from "../../invited/links.ts"
import { edgeResponse, edgeValue } from "../../lib/edge-cache.ts"
import { partPlan } from "../../publishing/parts.ts"
import { latestFiles } from "../files.ts"
import { feedReleases, linkReleases } from "../releases.ts"
import { linkBase, pageUrl } from "./addresses.ts"

const SHORT_CACHE = "public, max-age=60"
const CHANNEL = /^@([a-z][a-z0-9-]{0,19})$/

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>
type Signer = (releases: HostedRelease[]) => Promise<HostedRelease[]>

const unsigned: Signer = async (releases) => releases

async function loadProject(publisherSlug: string, slug: string) {
  const owned = and(eq(schema.publisher.slug, publisherSlug), eq(schema.app.slug, slug))
  const [[row], channels] = await db.batch([
    db
      .select({
        id: schema.app.id,
        publisherId: schema.app.publisherId,
        slug: schema.app.slug,
        kind: schema.app.kind,
        visibility: schema.app.visibility,
        status: schema.app.status,
        platforms: schema.app.platforms,
        parts: schema.app.parts,
        latestFollowsRollout: schema.app.latestFollowsRollout,
        name: schema.listing.name,
      })
      .from(schema.app)
      .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
      .leftJoin(
        schema.listing,
        and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
      )
      .where(owned),
    db
      .select({
        name: schema.channel.name,
        endedInto: schema.channel.endedInto,
        inviteOnly: schema.channel.inviteOnly,
      })
      .from(schema.channel)
      .innerJoin(schema.app, eq(schema.app.id, schema.channel.appId))
      .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
      .where(owned),
  ])
  return row ? { ...row, name: row.name ?? row.slug, publisherSlug, channels } : null
}

const findProject = (publisherSlug: string, slug: string) =>
  edgeValue(
    `https://hosting.schelf.internal/projects/${encodeURIComponent(publisherSlug)}/${encodeURIComponent(slug)}`,
    () => loadProject(publisherSlug, slug),
  )

function routeOf(project: Project, channel: string) {
  return channel === STABLE ? [STABLE] : channelPath(channel, endedChannelsOf(project.channels))
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

function sums(files: HostedFile[], cache = SHORT_CACHE) {
  return text(files.map((file) => `${file.sha256}  ${file.name}\n`).join(""), 200, undefined, cache)
}

function visitorTarget(request: Request) {
  const system = detect(
    request.headers.get("user-agent") ?? "",
    request.headers.get("sec-ch-ua-platform"),
    request.headers.get("sec-ch-ua-arch"),
  )
  return linkTarget(system)
}

function takePart(releases: HostedRelease[], path: string[]) {
  return path[0] && partNames(releases).has(path[0]) ? path.shift()! : null
}

function serveLatest(
  request: Request,
  project: Project,
  releases: HostedRelease[],
  path: string[],
  options: LinkOptions,
) {
  const part = takePart(releases, path)
  const scoped = partReleases(releases, part)
  const [target, kind] = path
  const offered = part ? scoped : releases
  const varies = options.followRollout && offered.some((release) => release.rollout < 100)
  if (target === "SHA256SUMS" && !kind) {
    const latest = latestRelease(offered, options)
    return latest?.files.length ? sums(latest.files, varies ? "no-store" : SHORT_CACHE) : notFound()
  }
  const wanted = target ?? visitorTarget(request)
  const resolved = wanted ? resolveLink(scoped, wanted, kind, options) : undefined
  if (resolved) return redirect(resolved.file.url, varies)
  return target
    ? notFound(`Nothing for ${target} yet`)
    : redirect(pageUrl(project, project.publisherSlug), false)
}

function serveVersion(releases: HostedRelease[], path: string[], channel: string, options: LinkOptions) {
  const [version, ...rest] = path
  const release = releases.find((candidate) => candidate.version === version)
  if (!release) return notFound(`There's no ${version} on ${channel}`)
  if (rest[0] === "SHA256SUMS" && rest.length === 1) return sums(release.files)
  if (!rest.length) return json(release)
  const pinned = [{ ...release, bridge: false, rollout: 100 }]
  const part = takePart(pinned, rest)
  const [target, kind] = rest
  const resolved = target ? resolveLink(partReleases(pinned, part), target, kind, options) : undefined
  return resolved
    ? redirect(resolved.file.url, false)
    : notFound(`${version} has nothing for ${[part, target].filter(Boolean).join(" ") || "that"}`)
}

interface Asked {
  request: Request
  project: Project
  named: string
  route: string[]
  path: string[]
  invited: Set<string>
  sign: Signer
}

async function answer(asked: Asked) {
  const { request, project, route, path, sign } = asked
  const channel = route.at(-1)!
  const releases = await sign(await linkReleases(project.id, route))
  const plan = partPlan(project)
  const offered = offeredReleases(releases, plan)
  const options: LinkOptions = { followRollout: project.latestFollowsRollout, draw: Math.random() }
  const [first, second] = path
  const cache = options.followRollout ? "no-store" : SHORT_CACHE

  const [, part, file, extra] = path
  if (first === "latest" && part && file && !extra && isFeed(file) && partNames(offered).has(part))
    return serveFeed(asked, file, part, options)
  if (first === "latest") return serveLatest(request, project, offered, path.slice(1), options)
  if (first === "v" && second) return serveVersion(releases, path.slice(1), channel, options)
  if (first === "latest.json" && !second) {
    const newest = latestRelease(offered, options)
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
        files: latestFiles(
          linkBase(await linkRoot(project, project.publisherSlug), channel),
          offered,
          options,
        ),
      } satisfies ProjectDownloads,
      cache,
    )
  }
  if (first && !second && isFeed(first)) return serveFeed(asked, first, null, options)
  return notFound()
}

const isFeed = (file: string) => file === "tauri.json" || electronFeedName(file) !== null

async function serveFeed(asked: Asked, file: string, part: string | null, options: LinkOptions) {
  const { request, project, named, route, invited, sign } = asked
  const plan = partPlan(project)
  const updater = part ? partUpdater(plan.parts[part]!) : null
  const scoped = async (list: HostedRelease[], signer: Signer) => {
    const releases = partReleases(offeredReleases(await signer(list), plan), part)
    return part
      ? releases.filter((release) => release.files.length).map((release) => ({ ...release, updater }))
      : releases
  }
  const cache = options.followRollout ? "no-store" : SHORT_CACHE
  if (file === "tauri.json") {
    const release = updaterRelease(
      await scoped(await feedReleases(project.id, route), sign),
      "tauri",
      options,
    )
    const feed = release && tauriFeed(release, part)
    return feed ? json(feed, cache) : new Response(null, { status: 204 })
  }
  const line = electronFeedName(file)!.channel
  const lineRoute = line === named ? route : routeOf(project, line)
  const lineGuard = line === named ? [] : lineRoute.filter((channel) => invited.has(channel))
  const lineAccess = lineGuard.length ? await channelsOpenTo(request, project, lineGuard) : "open"
  if (lineAccess !== "open") return shutOut(lineAccess)
  const lineReleases = await feedReleases(project.id, lineRoute)
  const feed = (await scoped(lineReleases, lineGuard.length ? signReleases : sign))
    .filter((candidate) => candidate.updater === "electron")
    .map((release) => electronFeed(release, file, part))
    .find(Boolean)
  if (!feed) return notFound(`There's no ${file} here`)
  return text(feed, 200, "text/yaml; charset=utf-8", lineGuard.length ? "no-store" : SHORT_CACHE)
}

async function projectResponse(request: Request, segments: string[]) {
  const [publisherSlug, slug, ...path] = segments
  const project = await findProject(publisherSlug!, slug!)
  if (
    !project ||
    project.status === "draft" ||
    project.status === "in-review" ||
    project.status === "delisted" ||
    project.status === "deleted"
  )
    return notFound("There's no project here")
  if (project.status === "pulled") return text("This project was pulled from Schelf", 410)
  const channelMatch = path[0] ? CHANNEL.exec(path[0]) : null
  const named = channelMatch ? channelMatch[1]! : STABLE
  if (channelMatch) path.shift()

  const invited = new Set(project.channels.flatMap((channel) => (channel.inviteOnly ? [channel.name] : [])))
  const route = routeOf(project, named)
  const guarding = route.filter((channel) => invited.has(channel))
  const access = guarding.length ? await channelsOpenTo(request, project, guarding) : "open"
  if (access !== "open") return shutOut(access)
  const response = await answer({
    request,
    project,
    named,
    route,
    path,
    invited,
    sign: guarding.length ? signReleases : unsigned,
  })
  if (!guarding.length) return response
  const headers = new Headers(response.headers)
  headers.set("cache-control", "no-store")
  return new Response(response.body, { status: response.status, headers })
}

/** Answers for a project's links and feeds; open channels' answers are shared from the edge, keyed on the visitor's platform. */
export function serveProject(request: Request, segments: string[]) {
  if (request.method !== "GET") return projectResponse(request, segments)
  const url = new URL(request.url)
  const key = `${url.origin}${url.pathname}?for=${visitorTarget(request) ?? ""}`
  return edgeResponse(key, () => projectResponse(request, segments))
}

export const DOWNLOAD_ROOTS = new Set(["apps", "index", "trust", "sabine", "media", "private", "invited"])

export function isProjectPath(segments: string[]) {
  return segments.length >= 2 && !DOWNLOAD_ROOTS.has(segments[0]!)
}
