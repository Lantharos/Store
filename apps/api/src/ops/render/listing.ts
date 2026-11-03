import { b } from "@lantharos/pult"
import { DEFAULT_LOCALE } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { fileUrl, mediaUrl } from "../../signing/records.ts"
import { link } from "../data/links.ts"

const MISSING = "Missing"

export async function listingBlocks(appId: string) {
  const [listing, meta, screenshots] = await Promise.all([
    db.query.listing.findFirst({
      where: and(eq(schema.listing.appId, appId), eq(schema.listing.locale, DEFAULT_LOCALE)),
    }),
    db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, appId) }),
    db
      .select()
      .from(schema.screenshot)
      .where(eq(schema.screenshot.appId, appId))
      .orderBy(schema.screenshot.position),
  ])
  const icon = mediaUrl(meta?.iconKey)
  return [
    b.fields({
      "listed as": listing?.name ?? MISSING,
      summary: listing?.summary ?? MISSING,
      categories: meta?.categories.join(", ") || MISSING,
      homepage: link(meta?.homepage),
      support: link(meta?.support),
      screenshots: screenshots.length,
    }),
    ...(listing?.description ? [b.markdown(listing.description)] : []),
    ...(icon ? [b.attachment({ name: "Icon", url: icon })] : []),
    ...screenshots.map((shot) =>
      b.attachment({ name: shot.caption ?? `Screenshot ${shot.position + 1}`, url: fileUrl(shot.key) }),
    ),
  ]
}
