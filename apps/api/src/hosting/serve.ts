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
  offeredReleases,
  type ProjectDownloads,
  partNames,
  partReleases,
  resolveLink,
  STABLE,
  tauriFeed,
  updaterRelease,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { channelsOpenTo } from "../invited/access.ts"
import { inviteOnlyChannels } from "../invited/channels.ts"
import { signReleases } from "../invited/links.ts"
import { partPlan } from "../publishing/parts.ts"
import { linkBase, pageUrl } from "./addresses.ts"
import { channelRoute } from "./ended.ts"
import { latestFiles } from "./files.ts"
import { feedReleases, linkReleases } from "./releases.ts"

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
  const varies = (release: HostedRelease) => options.followRollout && release.rollout < 100
  if (target === "SHA256SUMS" && !kind) {
    const latest = latestRelease(part ? scoped : releases, options)
    return latest?.files.length ? sums(latest.files) : notFound()
  }
  const wanted = target ?? visitorTarget(request)
  const resolved = wanted ? resolveLink(scoped, wanted, kind, options) : undefined
  if (resolved) return redirect(resolved.file.url, varies(resolved.release))
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

const unauthorized = () =>
  new Response("This channel is invite-only. Sign in to Schelf or send a download token.", {
    status: 401,
    headers: { "www-authenticate": "Bearer", "cache-control": "no-store" },
  })

interface Asked {
  request: Request
  project: Project
  named: string
  route: string[]
  path: string[]
  invited: Set<string>
  sign: (releases: HostedRelease[]) => Promise<HostedRelease[]>
}

async function answer({ request, project, named, route, path, invited, sign }: Asked) {
  const channel = route.at(-1)!
  const releases = await sign(await linkReleases(project.id, route))
  const plan = partPlan(project)
  const offered = offeredReleases(releases, plan)
  const options: LinkOptions = { followRollout: project.latestFollowsRollout, draw: Math.random() }
  const [first, second] = path
  const cache = options.followRollout ? "no-store" : SHORT_CACHE

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
        files: latestFiles(linkBase(project, project.publisherSlug, channel), offered, options),
      } satisfies ProjectDownloads,
      cache,
    )
  }
  const app = async (list: HostedRelease[]) => partReleases(offeredReleases(await sign(list), plan), null)
  if (first === "tauri.json" && !second) {
    const release = updaterRelease(await app(await feedReleases(project.id, route)), "tauri", options)
    const feed = release && tauriFeed(release)
    return feed ? json(feed, cache) : new Response(null, { status: 204 })
  }
  if (first && !second && electronFeedName(first)) {
    const line = electronFeedName(first)!.channel
    if (line !== named && invited.has(line) && !(await channelsOpenTo(request, project, [line])))
      return unauthorized()
    const lineReleases = await feedReleases(
      project.id,
      line === named ? route : await channelRoute(project.id, line),
    )
    const feed = (await app(lineReleases))
      .filter((candidate) => candidate.updater === "electron")
      .map((release) => electronFeed(release, first))
      .find(Boolean)
    return feed ? text(feed, 200, "text/yaml; charset=utf-8") : notFound(`There's no ${first} here`)
  }
  return notFound()
}

export async function serveProject(request: Request, segments: string[]) {
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

  const [route, invited] = await Promise.all([
    channelRoute(project.id, named),
    inviteOnlyChannels(project.id),
  ])
  const guarded = invited.has(named)
  if (guarded && !(await channelsOpenTo(request, project, [named]))) return unauthorized()
  const response = await answer({
    request,
    project,
    named,
    route,
    path,
    invited,
    sign: (releases) => (invited.size ? signReleases(releases) : Promise.resolve(releases)),
  })
  if (!guarded) return response
  const headers = new Headers(response.headers)
  headers.set("cache-control", "no-store")
  return new Response(response.body, { status: response.status, headers })
}

export const DOWNLOAD_ROOTS = new Set(["apps", "index", "trust", "sabine", "media", "private", "invited"])

export function isProjectPath(segments: string[]) {
  return segments.length >= 2 && !DOWNLOAD_ROOTS.has(segments[0]!)
}
