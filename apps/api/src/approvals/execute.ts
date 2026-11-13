import { type ApprovalAction, type ApprovalStep, NEW_PUBLISHER } from "@schelf/protocol"
import { and, eq, gt } from "drizzle-orm"
import type { Hono } from "hono"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { callOf } from "./actions.ts"
import type { ApprovalRow } from "./store.ts"

interface Answer {
  id?: string
  token?: string
  name?: string
  error?: string
}

const withPublisher = (action: ApprovalAction, created: string | null): ApprovalAction =>
  created && "publisher" in action && action.publisher === NEW_PUBLISHER
    ? { ...action, publisher: created }
    : action

async function claim(row: ApprovalRow) {
  const [claimed] = await db
    .update(schema.approval)
    .set({ status: "running", decidedAt: new Date() })
    .where(
      and(
        eq(schema.approval.id, row.id),
        eq(schema.approval.status, "pending"),
        gt(schema.approval.expiresAt, new Date()),
      ),
    )
    .returning()
  if (!claimed) fail(409, "This request was decided already, or it expired")
  return claimed
}

export async function executeApproval(row: ApprovalRow, dashboard: Hono<never>, headers: Headers) {
  const claimed = await claim(row)
  const steps: ApprovalStep[] = claimed.steps.map((step) => ({ ...step }))
  const secrets: Record<string, string> = {}
  let created: string | null = null
  let failed = false
  for (const [index, original] of claimed.actions.entries()) {
    const action = withPublisher(original, created)
    const call = callOf(action)
    const response = await dashboard.request(call.path, {
      method: call.method,
      headers: {
        cookie: headers.get("cookie") ?? "",
        authorization: headers.get("authorization") ?? "",
        "content-type": "application/json",
      },
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
    })
    const answer = (response.status === 204 ? {} : await response.json()) as Answer
    if (!response.ok) {
      steps[index] = {
        ...steps[index]!,
        outcome: "failed",
        detail: answer.error ?? `Answered ${response.status}`,
      }
      failed = true
      break
    }
    if (action.type === "publisher.create") created = answer.id!
    if (action.type === "token.create" || action.type === "channel.token")
      secrets[action.name] = answer.token!
    steps[index] = { ...steps[index]!, outcome: "done", detail: null }
  }
  const [finished] = await db
    .update(schema.approval)
    .set({ status: failed ? "failed" : "done", steps, secrets })
    .where(eq(schema.approval.id, row.id))
    .returning()
  return finished!
}
