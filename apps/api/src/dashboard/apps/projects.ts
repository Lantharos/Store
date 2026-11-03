import { createProject, DEFAULT_LOCALE, projectId, RESERVED_SLUGS, SCHELF_WORKFLOW } from "@schelf/protocol"
import { and, eq, like } from "drizzle-orm"
import type { Context } from "hono"
import { db, schema } from "../../db/client.ts"
import { repository } from "../../github/api.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { recordHistory } from "../../ops/events.ts"
import { active, allow, appAccess, type PublisherVars } from "../../publishers/access.ts"
import { githubAccount } from "../access.ts"
import { appSettings } from "./settings.ts"

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

export async function addProject(c: Context<PublisherVars>) {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const input = await readBody(c, createProject)
  const publisher = c.var.publisher
  if (RESERVED_SLUGS.has(input.slug)) fail(422, "That name is reserved")
  const id = projectId(publisher.slug, input.slug)
  const [sameSlug, sameId] = await Promise.all([
    db.$count(schema.app, and(eq(schema.app.publisherId, publisher.id), eq(schema.app.slug, input.slug))),
    db.$count(schema.app, eq(schema.app.id, id)),
  ])
  if (sameSlug || sameId) fail(409, `${publisher.slug}/${input.slug} is taken`)
  const repo = input.repository
    ? await repository(input.repository, (await githubAccount(c.var.viewer.id))?.token)
    : null
  if (input.repository && !repo) fail(422, `GitHub has no repository ${input.repository} that you can see`)

  await db.batch([
    db.insert(schema.app).values({
      id,
      slug: input.slug,
      publisherId: publisher.id,
      kind: "app",
      format: "files",
      visibility: "unlisted",
      repository: repo?.full_name ?? null,
      repositoryId: repo ? String(repo.id) : null,
      licence: input.distribution === "open" ? (input.licence ?? null) : null,
      distribution: input.distribution,
    }),
    db.insert(schema.listing).values({ appId: id, locale: DEFAULT_LOCALE, name: input.name, summary: "" }),
    db.insert(schema.listingMeta).values({ appId: id }),
    ...(repo
      ? [
          db.insert(schema.trustedPublisher).values({
            id: randomId(),
            appId: id,
            ownerId: String(repo.owner.id),
            repositoryId: String(repo.id),
            repository: repo.full_name,
            workflow: SCHELF_WORKFLOW,
          }),
        ]
      : []),
  ])
  recordHistory("app", id, "Added as an unlisted project", c.var.viewer.name)
  return c.json(await appSettings((await appAccess(c.var.viewer, id)).app), 201)
}
