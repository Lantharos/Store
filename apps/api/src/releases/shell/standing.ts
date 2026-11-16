import { extensionWidens, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, inArray, isNull, ne, notExists, or } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { runRepository } from "../../github/oidc.ts"
import type { ReleaseRow } from "../../signing/records.ts"

const publishedBy = (release: ReleaseRow) =>
  release.origin === "oidc" ? `${runRepository(release.runUrl!)} ${release.workflow}` : "dashboard"

const unblocked = notExists(
  db
    .select({ id: schema.block.id })
    .from(schema.block)
    .where(
      and(
        eq(schema.block.appId, schema.release.appId),
        eq(schema.block.action, "block"),
        isNull(schema.block.liftedAt),
        or(isNull(schema.block.releaseId), eq(schema.block.releaseId, schema.release.id)),
      ),
    ),
)

export async function standingApproval(release: ReleaseRow, verifiedAt: Date) {
  const [standing] = await db
    .select()
    .from(schema.release)
    .where(
      and(
        eq(schema.release.appId, release.appId),
        eq(schema.release.shellReview, "approved"),
        ne(schema.release.id, release.id),
        inArray(schema.release.status, [...SHIPPED_STATUSES]),
        unblocked,
      ),
    )
    .orderBy(desc(schema.release.shellDecidedAt))
    .limit(1)
  if (
    !standing ||
    standing.shellDecidedAt! < verifiedAt ||
    publishedBy(standing) !== publishedBy(release) ||
    extensionWidens(standing.extensionAccess, release.extensionAccess!)
  )
    return null
  return standing
}
