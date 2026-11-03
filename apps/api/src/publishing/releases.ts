import {
  type PromoteRequest,
  type PublishedRelease,
  type PublishedReleases,
  SHIPPED_STATUSES,
} from "@schelf/protocol"
import { and, desc, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { promote } from "../hosting/channels.ts"
import { fail } from "../lib/http.ts"
import type { ReleaseRow } from "../signing/records.ts"
import { identifyPublisher, type Publisher } from "./publisher.ts"
import { appById } from "./start.ts"

const isOut = (release: ReleaseRow) => (SHIPPED_STATUSES as readonly string[]).includes(release.status)

function described(release: ReleaseRow): PublishedRelease {
  return {
    release: release.id,
    version: release.version,
    channel: release.channel,
    status: release.status,
    commit: release.commit,
    created: release.createdAt.toISOString(),
  }
}

async function publishersApp(credential: string | null, id: string) {
  const app = await appById(id)
  if (!app) fail(404, `schelf.store has no ${id}`)
  return { app, publisher: await identifyPublisher(credential, app) }
}

const promoter = (publisher: Publisher) =>
  publisher.origin === "oidc" ? `${publisher.claims.repository} (${publisher.workflow})` : "A dashboard token"

export async function publishedReleases(credential: string | null, id: string): Promise<PublishedReleases> {
  const { app } = await publishersApp(credential, id)
  const releases = await db
    .select()
    .from(schema.release)
    .where(eq(schema.release.appId, app.id))
    .orderBy(desc(schema.release.createdAt))
  return { app: app.id, releases: releases.map(described) }
}

export async function promoteForPublisher(credential: string | null, id: string, input: PromoteRequest) {
  const { app, publisher } = await publishersApp(credential, id)
  const releases = await db
    .select()
    .from(schema.release)
    .where(and(eq(schema.release.appId, app.id), eq(schema.release.version, input.version)))
  const already = releases.find((release) => release.channel === input.channel)
  if (already) return described(already)
  const source = releases.find(isOut)
  if (!source) fail(409, `${app.id} ${input.version} isn't out on any channel`)
  const promoted = await promote(source, input.channel, promoter(publisher), input.notes)
  return described((await db.query.release.findFirst({ where: eq(schema.release.id, promoted) }))!)
}
