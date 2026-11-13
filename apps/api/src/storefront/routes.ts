import { env } from "cloudflare:workers"
import {
  type AppIndex,
  type AppPage,
  type CatalogEntry,
  type FeaturedResponse,
  type FeaturedSection,
  featuredQuery,
  hasAppPart,
  type MirrorEntry,
  offeredReleases,
  type PublisherPage,
  paths,
  type ReportResponse,
  reportRequest,
  type SearchHit,
  type SearchResponse,
  STABLE,
  searchQuery,
} from "@schelf/protocol"
import { eq, sum } from "drizzle-orm"
import { Hono } from "hono"
import { avatarUrl } from "../avatars/urls.ts"
import { db, schema } from "../db/client.ts"
import { linkBase, projectSummary } from "../hosting/addresses.ts"
import { latestFiles } from "../hosting/files.ts"
import { linkReleases } from "../hosting/releases.ts"
import { inviteOnlyChannels } from "../invited/channels.ts"
import { fail, readBody, readQuery } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { tellOps } from "../ops/events.ts"
import { partPlan } from "../publishing/parts.ts"
import { appByProject } from "../publishing/start.ts"
import { replacementOf } from "../releases/replacing.ts"
import { type AppRow, installsSince, mediaUrl } from "../signing/records.ts"
import { currentCatalog } from "./catalog.ts"
import { mirrorEntry, mirrorHits } from "./mirror.ts"
import { confirmReport } from "./report-mail.ts"
import { searchKeys } from "./search-index.ts"

const SECTION_SIZE = 12
const SEARCH_WINDOW = 90
const PUBLIC_CACHE = "public, max-age=60"
const PAGE_LINKS = { followRollout: false, draw: 0 }

export const storefrontRoutes = new Hono()

function visible(entry: CatalogEntry, platform: string | undefined, kind: string | undefined) {
  if (kind ? entry.kind !== kind : entry.kind !== "app") return false
  return !platform || Object.keys(entry.platforms).length === 0 || platform in entry.platforms
}

storefrontRoutes.get("/search", async (c) => {
  const query = readQuery(c, searchQuery)
  const { byId, catalog } = await currentCatalog()
  if (!query.q) {
    const results = catalog.apps
      .filter((entry) => visible(entry, query.platform, query.kind))
      .slice(0, query.limit)
    return c.json({
      results: results.map((entry) => ({ origin: "schelf" as const, ...entry })),
    } satisfies SearchResponse)
  }
  const keys = await searchKeys(query.q, SEARCH_WINDOW, query.kind === "extension" ? "schelf" : undefined)
  const mirrored = await mirrorHits(keys.map((key) => key.key))
  const results: SearchHit[] = []
  for (const { key } of keys) {
    const [origin, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)]
    if (origin === "schelf") {
      const entry = byId.get(id)
      if (entry && visible(entry, query.platform, query.kind)) results.push({ origin: "schelf", ...entry })
    } else if (
      query.kind !== "extension" &&
      (!query.platform || query.platform.startsWith("linux") || query.platform.startsWith("luft"))
    ) {
      const hit = mirrored.get(key)
      if (hit && !byId.has(hit.id)) results.push(hit)
    }
    if (results.length === query.limit) break
  }
  c.header("cache-control", PUBLIC_CACHE)
  return c.json({ results } satisfies SearchResponse)
})

storefrontRoutes.get("/featured", async (c) => {
  const query = readQuery(c, featuredQuery)
  const { catalog } = await currentCatalog()
  const apps = catalog.apps.filter((entry) => visible(entry, query.platform, undefined))
  const byUpdated = [...apps].sort((left, right) => right.updated.localeCompare(left.updated))
  const categories = new Map<string, number>()
  for (const entry of apps)
    for (const name of entry.categories) categories.set(name, (categories.get(name) ?? 0) + 1)
  const sections: FeaturedSection[] = [
    { id: "popular", title: "Popular", apps: apps.slice(0, SECTION_SIZE) },
    {
      id: "updated",
      title: "Recently updated",
      apps: byUpdated.filter((entry) => Object.keys(entry.platforms).length).slice(0, SECTION_SIZE),
    },
    {
      id: "coming-soon",
      title: "Coming soon",
      apps: apps.filter((entry) => !Object.keys(entry.platforms).length).slice(0, SECTION_SIZE),
    },
  ]
  c.header("cache-control", PUBLIC_CACHE)
  return c.json({
    sections: sections.filter((section) => section.apps.length),
    categories: [...categories]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count),
  } satisfies FeaturedResponse)
})

async function appPage(app: AppRow | undefined): Promise<AppPage> {
  if (!app || (app.status !== "published" && app.status !== "delisted" && app.status !== "pulled"))
    fail(404, "There's no app with that id")
  const [object, owner, last30, [total], replacement, releases, inviteOnly] = await Promise.all([
    env.BUCKET.get(paths.app(app.id)),
    db.query.publisher.findFirst({ where: eq(schema.publisher.id, app.publisherId) }),
    installsSince([app.id], 30),
    db
      .select({ installs: sum(schema.countDaily.installs) })
      .from(schema.countDaily)
      .where(eq(schema.countDaily.appId, app.id)),
    replacementOf(app),
    linkReleases(app.id, [STABLE]),
    inviteOnlyChannels(app.id),
  ])
  if (!object) fail(404, "There's no app with that id")
  const plan = partPlan(app)
  const parts = latestFiles(linkBase(app, owner!.slug), offeredReleases(releases, plan), PAGE_LINKS)
  return {
    app: await object.json<AppIndex>(),
    status: app.status,
    installs: { last_30_days: last30.get(app.id) ?? 0, total: Number(total?.installs ?? 0) },
    project: projectSummary(app, owner!.slug),
    replacement,
    has_app: hasAppPart(plan),
    parts: parts.filter((file) => file.part !== null),
    invite_only: [...inviteOnly],
  }
}

storefrontRoutes.get("/apps/:id", async (c) => {
  const page = await appPage(await db.query.app.findFirst({ where: eq(schema.app.id, c.req.param("id")) }))
  c.header("cache-control", PUBLIC_CACHE)
  return c.json(page satisfies AppPage)
})

storefrontRoutes.get("/projects/:publisher/:project", async (c) => {
  const page = await appPage(await appByProject(c.req.param("publisher"), c.req.param("project")))
  c.header("cache-control", PUBLIC_CACHE)
  return c.json(page satisfies AppPage)
})

storefrontRoutes.get("/mirror/:id", async (c) => {
  const entry = await mirrorEntry(c.req.param("id"), c.req.query("origin"))
  if (!entry) fail(404, "There's no app with that id")
  c.header("cache-control", PUBLIC_CACHE)
  return c.json(entry satisfies MirrorEntry)
})

storefrontRoutes.get("/publishers/:slug", async (c) => {
  const [row] = await db
    .select({ publisher: schema.publisher, owner: schema.user })
    .from(schema.publisher)
    .innerJoin(schema.user, eq(schema.user.id, schema.publisher.ownerId))
    .where(eq(schema.publisher.slug, c.req.param("slug")))
  if (!row) fail(404, "There's no publisher by that name")
  const { publisher, owner } = row
  const { catalog } = await currentCatalog()
  c.header("cache-control", PUBLIC_CACHE)
  return c.json({
    name: publisher.name,
    slug: publisher.slug,
    kind: publisher.kind,
    description: publisher.description,
    website: publisher.website,
    logo: mediaUrl(publisher.logoKey) ?? (publisher.kind === "person" ? avatarUrl(owner) : null),
    verified: publisher.verifiedAt !== null,
    apps: catalog.apps.filter((entry) => entry.publisher.slug === publisher.slug),
  } satisfies PublisherPage)
})

storefrontRoutes.post("/reports", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "local"
  if (!(await env.REPORT_LIMIT.limit({ key: ip })).success)
    fail(429, "Too many reports, try again in a minute")
  const report = await readBody(c, reportRequest)
  const id = randomId()
  await db.insert(schema.report).values({
    id,
    appId: report.app,
    kind: report.kind,
    reporterEmail: report.email ?? null,
    details: JSON.stringify({
      reason: report.reason,
      explanation: report.explanation,
      location: report.location ?? null,
      name: report.name ?? null,
    }),
  })
  tellOps({ type: "report", report: id })
  if (report.email) confirmReport(report.email, { id, app: report.app, kind: report.kind })
  return c.json({ id } satisfies ReportResponse, 201)
})
