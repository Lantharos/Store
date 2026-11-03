import {
  type AppSettings,
  createApp,
  type DashboardApp,
  DEFAULT_LOCALE,
  formatFits,
  namespaceCovers,
  slugFromId,
} from "@schelf/protocol"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { repository } from "../../github/api.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { recordHistory } from "../../ops/events.ts"
import { active, allow, appAccess, type PublisherVars } from "../../publishers/access.ts"
import { installsSince, mediaUrl } from "../../signing/records.ts"
import { githubAccount } from "../access.ts"
import { addProject, freeAppSlug } from "./projects.ts"
import { appSettings } from "./settings.ts"

export const publisherAppRoutes = new Hono<PublisherVars>()
export const appRoutes = new Hono<SignedInVars>()

publisherAppRoutes.get("/", async (c) => {
  const apps = await db
    .select({
      app: schema.app,
      name: schema.listing.name,
      iconKey: schema.listingMeta.iconKey,
    })
    .from(schema.app)
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .leftJoin(schema.listingMeta, eq(schema.listingMeta.appId, schema.app.id))
    .where(eq(schema.app.publisherId, c.var.publisher.id))
  const ids = apps.map((row) => row.app.id)
  const extensions = apps.filter((row) => row.app.kind === "extension").map((row) => row.app.id)
  const [releases, installs, shots] = await Promise.all([
    db
      .select({ appId: schema.release.appId, version: schema.release.version, status: schema.release.status })
      .from(schema.release)
      .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
      .where(eq(schema.app.publisherId, c.var.publisher.id))
      .orderBy(desc(schema.release.createdAt)),
    installsSince(ids, 7),
    extensions.length
      ? db
          .select({ appId: schema.screenshot.appId, key: schema.screenshot.key })
          .from(schema.screenshot)
          .where(inArray(schema.screenshot.appId, extensions))
          .orderBy(desc(schema.screenshot.position))
      : [],
  ])
  const artByApp = new Map(shots.map((shot) => [shot.appId, shot.key]))
  const latestByApp = new Map<string, (typeof releases)[number]>()
  for (const release of releases) if (!latestByApp.has(release.appId)) latestByApp.set(release.appId, release)
  return c.json(
    apps.map(({ app, name, iconKey }) => ({
      id: app.id,
      slug: app.slug,
      publisher: app.publisherId,
      publisher_slug: c.var.publisher.slug,
      visibility: app.visibility,
      listing_requested: app.listingRequestedAt !== null,
      updater: app.updater,
      kind: app.kind,
      format: app.format,
      name: name ?? app.slug,
      icon: mediaUrl(iconKey),
      art: mediaUrl(artByApp.get(app.id)),
      status: app.status,
      version: latestByApp.get(app.id)?.version ?? null,
      release_status: latestByApp.get(app.id)?.status ?? null,
      installs_7d: installs.get(app.id) ?? 0,
    })) satisfies DashboardApp[],
  )
})

publisherAppRoutes.post("/", async (c) => {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const input = await readBody(c, createApp)
  const publisher = c.var.publisher
  if (!formatFits(input.kind, input.format)) fail(422, `A ${input.kind} can't be a ${input.format}`)
  const namespaces = await db
    .select()
    .from(schema.namespace)
    .where(eq(schema.namespace.publisherId, publisher.id))
  if (!namespaces.some((entry) => entry.verifiedAt && namespaceCovers(entry.prefix, input.id)))
    fail(403, `Prove you own the namespace of ${input.id} first`)
  const taken = await db.$count(schema.app, sql`lower(${schema.app.id}) = lower(${input.id})`)
  if (taken) fail(409, `${input.id} is taken`)
  const account = await githubAccount(c.var.viewer.id)
  const repo = await repository(input.repository, account?.token)
  if (!repo) fail(422, `GitHub has no repository ${input.repository} that you can see`)

  const now = new Date()
  await db.batch([
    db.insert(schema.app).values({
      id: input.id,
      slug: await freeAppSlug(publisher.id, slugFromId(input.id)),
      publisherId: publisher.id,
      kind: input.kind,
      format: input.format,
      updater: input.format === "sabine" ? "sabine" : null,
      repository: repo.full_name,
      repositoryId: String(repo.id),
      distribution: repo.private ? "proprietary" : "open",
      createdAt: now,
    }),
    db.insert(schema.listing).values({
      appId: input.id,
      locale: DEFAULT_LOCALE,
      name: input.name,
      summary: input.summary,
    }),
    db.insert(schema.listingMeta).values({ appId: input.id }),
    db.insert(schema.trustedPublisher).values({
      id: randomId(),
      appId: input.id,
      ownerId: String(repo.owner.id),
      repositoryId: String(repo.id),
      repository: repo.full_name,
      workflow: input.workflow,
      environment: input.environment ?? null,
      createdAt: now,
    }),
  ])
  recordHistory("app", input.id, `Added, published from ${repo.full_name}`, c.var.viewer.name)
  return c.json(await appSettings((await appAccess(c.var.viewer, input.id)).app), 201)
})

publisherAppRoutes.post("/projects", addProject)

appRoutes.get("/:id", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"))
  return c.json((await appSettings(app)) satisfies AppSettings)
})
