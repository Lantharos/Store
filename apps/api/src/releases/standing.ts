import { extensionWidens } from "@schelf/protocol"
import { and, desc, eq, ne } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { runRepository } from "../github/oidc.ts"
import type { ReleaseRow } from "../signing/records.ts"

const publishedBy = (release: ReleaseRow) =>
  release.origin === "oidc" ? `${runRepository(release.runUrl!)} ${release.workflow}` : "dashboard"

export async function standingApproval(release: ReleaseRow, verifiedAt: Date) {
  const standing = await db.query.release.findFirst({
    where: and(
      eq(schema.release.appId, release.appId),
      eq(schema.release.shellReview, "approved"),
      ne(schema.release.id, release.id),
    ),
    orderBy: desc(schema.release.shellDecidedAt),
  })
  if (
    !standing ||
    standing.shellDecidedAt! < verifiedAt ||
    publishedBy(standing) !== publishedBy(release) ||
    extensionWidens(standing.extensionAccess, release.extensionAccess!)
  )
    return null
  return standing
}
