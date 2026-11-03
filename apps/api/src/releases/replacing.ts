import { DEFAULT_LOCALE, type Replacement } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { pageUrl } from "../hosting/addresses.ts"
import { delist } from "./moderation.ts"

async function listedApp(id: string) {
  const [row] = await db
    .select({ app: schema.app, publisherSlug: schema.publisher.slug, name: schema.listing.name })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(
      and(eq(schema.app.id, id), eq(schema.app.status, "published"), eq(schema.app.visibility, "listed")),
    )
  return row
}

export async function replaceApp(appId: string, replacementId: string, note: string) {
  if (replacementId === appId) throw new Error("An app can't replace itself")
  const replacement = await listedApp(replacementId)
  if (!replacement) throw new Error("There's no listed app with that id")
  await delist(appId, { id: replacement.app.id, note })
  return replacement.name ?? replacement.app.id
}

export async function replacementOf(app: { replacedBy: string | null; replacedNote: string | null }) {
  if (!app.replacedBy) return null
  const replacement = await listedApp(app.replacedBy)
  if (!replacement) return null
  return {
    id: replacement.app.id,
    name: replacement.name ?? replacement.app.id,
    page: pageUrl(replacement.app, replacement.publisherSlug),
    note: app.replacedNote ?? "",
  } satisfies Replacement
}
