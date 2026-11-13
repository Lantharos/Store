import { type AppSettings, type DashboardApp, DEFAULT_LOCALE, projectGroup } from "@schelf/protocol"
import { and, desc, eq, inArray, ne } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { appAccess, type PublisherVars } from "../../publishers/access.ts"
import { installsSince, mediaUrl } from "../../signing/records.ts"
import { restorableProjects } from "./deleting.ts"
import { addApp, addProject } from "./projects.ts"
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
    .where(and(eq(schema.app.publisherId, c.var.publisher.id), ne(schema.app.status, "deleted")))
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
      group: projectGroup(app),
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

publisherAppRoutes.post("/", addApp)
publisherAppRoutes.post("/projects", addProject)
publisherAppRoutes.get("/deleted", restorableProjects)

appRoutes.get("/:id", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"))
  return c.json((await appSettings(app)) satisfies AppSettings)
})
