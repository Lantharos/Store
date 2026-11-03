import {
  createApp,
  createProject,
  DEFAULT_LOCALE,
  formatFits,
  namespaceCovers,
  projectId,
  RESERVED_SLUGS,
  slugFromId,
} from "@schelf/protocol"
import { and, eq, like } from "drizzle-orm"
import type { Context } from "hono"
import type { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { repository } from "../../github/api.ts"
import { reclaimPurged } from "../../hosting/deletion.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { recordHistory } from "../../ops/events.ts"
import { active, allow, appAccess, type PublisherVars } from "../../publishers/access.ts"
import { githubAccount } from "../access.ts"
import { appSettings } from "./settings.ts"

type NewProject = z.output<typeof createProject> | z.output<typeof createApp>
type AppValues = Omit<
  typeof schema.app.$inferInsert,
  "repository" | "repositoryId" | "licence" | "distribution"
>

export async function freeAppSlug(publisherId: string, base: string) {
  const taken = new Set(
    (
      await db
        .select({ slug: schema.app.slug })
        .from(schema.app)
        .where(and(eq(schema.app.publisherId, publisherId), like(schema.app.slug, `${base}%`)))
    ).map((row) => row.slug),
  )
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

async function insertProject(c: Context<PublisherVars>, input: NewProject, values: AppValues) {
  const repo = input.repository
    ? await repository(input.repository, (await githubAccount(c.var.viewer.id))?.token)
    : null
  if (input.repository && !repo) fail(422, `GitHub has no repository ${input.repository} that you can see`)
  const now = new Date()
  await db.batch([
    db.insert(schema.app).values({
      ...values,
      repository: repo?.full_name ?? null,
      repositoryId: repo ? String(repo.id) : null,
      licence: input.distribution === "open" ? (input.licence ?? null) : null,
      distribution: input.distribution,
      createdAt: now,
    }),
    db.insert(schema.listing).values({
      appId: values.id,
      locale: DEFAULT_LOCALE,
      name: input.name,
      summary: input.summary,
    }),
    db.insert(schema.listingMeta).values({ appId: values.id }),
    ...(repo
      ? [
          db.insert(schema.trustedPublisher).values({
            id: randomId(),
            appId: values.id,
            ownerId: String(repo.owner.id),
            repositoryId: String(repo.id),
            repository: repo.full_name,
            workflow: input.workflow,
            environment: input.environment || null,
            createdAt: now,
          }),
        ]
      : []),
  ])
  recordHistory(
    "app",
    values.id,
    repo ? `Added, published from ${repo.full_name}` : "Added, published by hand",
    c.var.viewer.name,
  )
  return c.json(await appSettings((await appAccess(c.var.viewer, values.id)).app), 201)
}

export async function addApp(c: Context<PublisherVars>) {
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
  await reclaimPurged(publisher.id, input.id)
  return insertProject(c, input, {
    id: input.id,
    slug: await freeAppSlug(publisher.id, slugFromId(input.id)),
    publisherId: publisher.id,
    kind: input.kind,
    format: input.format,
    updater: input.format === "sabine" ? "sabine" : null,
    visibility: input.visibility,
  })
}

export async function addProject(c: Context<PublisherVars>) {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const input = await readBody(c, createProject)
  const publisher = c.var.publisher
  if (RESERVED_SLUGS.has(input.slug)) fail(422, "That name is reserved")
  const id = projectId(publisher.slug, input.slug)
  await reclaimPurged(publisher.id, id)
  if (
    await db.$count(
      schema.app,
      and(eq(schema.app.publisherId, publisher.id), eq(schema.app.slug, input.slug)),
    )
  )
    fail(409, `${publisher.slug}/${input.slug} is taken`)
  return insertProject(c, input, {
    id,
    slug: input.slug,
    publisherId: publisher.id,
    kind: "app",
    format: "files",
    updater: input.updater ?? null,
    visibility: "unlisted",
  })
}
