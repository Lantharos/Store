import { waitUntil } from "cloudflare:workers"
import { sha256Hex, TOKEN_PREFIX } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { errors } from "jose"
import { db, schema } from "../db/client.ts"
import {
  allowsRef,
  matchesWorkflow,
  runUrl,
  verifyWorkflowToken,
  type WorkflowClaims,
  workflowPath,
} from "../github/oidc.ts"
import { fail } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"

const LAST_USED_GRANULARITY_MS = 60_000

export type Publisher =
  | { origin: "oidc"; ref: string; commit: string; runUrl: string; workflow: string; claims: WorkflowClaims }
  | { origin: "manual"; tokenId: string | null }

export async function workflowClaims(token: string) {
  try {
    return await verifyWorkflowToken(token)
  } catch (error) {
    if (error instanceof errors.JOSEError)
      fail(401, "That GitHub identity token isn't valid for schelf.store")
    throw error
  }
}

async function dashboardToken(token: string, app: AppRow): Promise<Publisher> {
  const row = await db.query.token.findFirst({ where: eq(schema.token.hash, await sha256Hex(token)) })
  const now = new Date()
  if (!row || row.revokedAt || row.expiresAt < now) fail(401, "That token isn't valid any more")
  if (row.appId !== app.id) fail(403, `That token publishes ${row.appId}, not ${app.id}`)
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS)
    waitUntil(db.update(schema.token).set({ lastUsedAt: now }).where(eq(schema.token.id, row.id)))
  return { origin: "manual", tokenId: row.id }
}

async function trustedWorkflow(token: string, app: AppRow): Promise<Publisher> {
  const claims = await workflowClaims(token)
  const rules = await db
    .select()
    .from(schema.trustedPublisher)
    .where(eq(schema.trustedPublisher.appId, app.id))
  const trusted = rules.filter((rule) => matchesWorkflow(claims, rule))
  if (!trusted.length)
    fail(
      403,
      `${claims.repository} (${workflowPath(claims) ?? claims.workflow_ref}) isn't a trusted publisher of ${app.id}`,
    )
  if (!trusted.some((rule) => allowsRef(rule, claims.ref)))
    fail(
      403,
      `${app.id} publishes only from ${trusted.map((rule) => rule.ref).join(" or ")}, and this run is for ${claims.ref}`,
    )
  return {
    origin: "oidc",
    ref: claims.ref,
    commit: claims.sha,
    runUrl: runUrl(claims),
    workflow: workflowPath(claims)!,
    claims,
  }
}

export function identifyPublisher(credential: string | null, app: AppRow) {
  if (!credential) fail(401, "Publish with a GitHub identity token or a dashboard token")
  return credential.startsWith(TOKEN_PREFIX)
    ? dashboardToken(credential, app)
    : trustedWorkflow(credential, app)
}
