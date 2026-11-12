import { env } from "cloudflare:workers"
import {
  APPROVAL_MINUTES,
  type Approval,
  type ApprovalAction,
  type ApprovalStatus,
  PASSKEY_ACTIONS,
} from "@schelf/protocol"
import { and, count, eq, gt } from "drizzle-orm"
import type { Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { iso } from "../lib/time.ts"
import { describeAction } from "./actions.ts"

export type ApprovalRow = typeof schema.approval.$inferSelect

const MAX_PENDING = 10
const MINUTE = 60_000

export const approvalUrl = (id: string) => `${env.PUBLIC_URL}/approve/${id}`

export function statusOf(row: ApprovalRow, now = new Date()): ApprovalStatus {
  if (row.status === "running") return "pending"
  if (row.status === "pending" && row.expiresAt <= now) return "expired"
  return row.status
}

export async function openApproval(
  viewer: Viewer,
  actions: ApprovalAction[],
  from: { host?: string; place: string | null },
) {
  if (!(await env.REQUEST_LIMIT.limit({ key: viewer.id })).success)
    fail(429, "Too many requests for approval; wait a minute")
  const [pending] = await db
    .select({ count: count() })
    .from(schema.approval)
    .where(
      and(
        eq(schema.approval.userId, viewer.id),
        eq(schema.approval.status, "pending"),
        gt(schema.approval.expiresAt, new Date()),
      ),
    )
  if ((pending?.count ?? 0) >= MAX_PENDING)
    fail(429, `${MAX_PENDING} requests are already waiting; approve or cancel some first`)
  const now = new Date()
  const row: ApprovalRow = {
    id: randomId(20),
    userId: viewer.id,
    actions,
    steps: await Promise.all(
      actions.map(async (action) => ({
        type: action.type,
        summary: await describeAction(action),
        outcome: null,
        detail: null,
      })),
    ),
    secrets: {},
    passkey: actions.some((action) => PASSKEY_ACTIONS.has(action.type)),
    status: "pending",
    host: from.host ?? null,
    place: from.place,
    expiresAt: new Date(now.getTime() + APPROVAL_MINUTES * MINUTE),
    decidedAt: null,
    createdAt: now,
  }
  await db.insert(schema.approval).values(row)
  return row
}

export async function approvalFor(viewer: Viewer, id: string) {
  const row = await db.query.approval.findFirst({
    where: and(eq(schema.approval.id, id), eq(schema.approval.userId, viewer.id)),
  })
  if (!row) fail(404, "There's no request with that id for you")
  return row
}

export function approvalView(row: ApprovalRow, requestedBy: string, secrets = false): Approval {
  return {
    id: row.id,
    url: approvalUrl(row.id),
    status: statusOf(row),
    steps: row.steps,
    passkey: row.passkey,
    requested_by: requestedBy,
    host: row.host,
    place: row.place,
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
    decided_at: iso(row.decidedAt),
    secrets: secrets ? row.secrets : {},
  }
}
