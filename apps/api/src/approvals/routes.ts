import { createApproval, PASSKEY_MINUTES } from "@schelf/protocol"
import { and, desc, eq, gt } from "drizzle-orm"
import { Hono } from "hono"
import { inBrowser, type SignedInVars, viewerOf } from "../auth/session.ts"
import { dashboardRoutes } from "../dashboard/routes.ts"
import { db, schema } from "../db/client.ts"
import { fail, readBody } from "../lib/http.ts"
import { checkScopes } from "./actions.ts"
import { executeApproval } from "./execute.ts"
import { approvalFor, approvalView, openApproval, statusOf } from "./store.ts"

const MINUTE = 60_000

export const approvalRoutes = new Hono<SignedInVars>()

function placeOf(request: Request) {
  const cf = request.cf as { city?: string; country?: string } | undefined
  return [cf?.city, cf?.country].filter(Boolean).join(", ") || null
}

approvalRoutes.post("/", async (c) => {
  const { actions, host } = await readBody(c, createApproval)
  await checkScopes(c.var.viewer, actions)
  const row = await openApproval(c.var.viewer, actions, { host, place: placeOf(c.req.raw) })
  return c.json(approvalView(row, c.var.viewer.name), 201)
})

approvalRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(schema.approval)
    .where(
      and(
        eq(schema.approval.userId, c.var.viewer.id),
        eq(schema.approval.status, "pending"),
        gt(schema.approval.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.approval.createdAt))
  return c.json(rows.map((row) => approvalView(row, c.var.viewer.name)))
})

approvalRoutes.get("/:id", async (c) => {
  const row = await approvalFor(c.var.viewer, c.req.param("id"))
  const fromCommand = !inBrowser(c.var.signed)
  if (fromCommand && Object.keys(row.secrets).length)
    await db.update(schema.approval).set({ secrets: {} }).where(eq(schema.approval.id, row.id))
  return c.json(approvalView(row, c.var.viewer.name, fromCommand))
})

approvalRoutes.post("/:id/approve", async (c) => {
  const { signed } = (await viewerOf(c.req.raw.headers, true))!
  if (!inBrowser(signed)) fail(403, "Approve this in the browser")
  const row = await approvalFor(c.var.viewer, c.req.param("id"))
  if (statusOf(row) !== "pending") fail(409, "This request was decided already, or it expired")
  const fresh = Date.now() - signed.since.getTime() < PASSKEY_MINUTES * MINUTE
  if (row.passkey && !(signed.via === "passkey" && fresh)) fail(403, "Confirm with your passkey first")
  const finished = await executeApproval(row, dashboardRoutes as never, c.req.raw.headers)
  return c.json(approvalView(finished, c.var.viewer.name))
})

approvalRoutes.post("/:id/cancel", async (c) => {
  const row = await approvalFor(c.var.viewer, c.req.param("id"))
  if (statusOf(row) !== "pending") fail(409, "This request was decided already, or it expired")
  const [cancelled] = await db
    .update(schema.approval)
    .set({ status: "cancelled", decidedAt: new Date() })
    .where(eq(schema.approval.id, row.id))
    .returning()
  return c.json(approvalView(cancelled!, c.var.viewer.name))
})
