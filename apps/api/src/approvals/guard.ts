import { API_BASE } from "@schelf/protocol"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { inBrowser, type SignedInVars } from "../auth/session.ts"
import { fail } from "../lib/http.ts"

type Rule = { methods: string[]; path: RegExp; when?: (body: Record<string, unknown>) => boolean }

const ID = "[^/]+"
const rule = (methods: string, path: string, when?: Rule["when"]): Rule => ({
  methods: methods.split(" "),
  path: new RegExp(`^${path.replaceAll(":id", ID)}$`),
  when,
})

const NEEDS_APPROVAL = [
  rule("POST", "/publishers"),
  rule("PATCH", "/publishers/:id", (body) => "name" in body || "slug" in body || "agreement" in body),
  rule("POST", "/publishers/:id/namespaces"),
  rule("PUT", "/publishers/:id/domain"),
  rule("DELETE", "/publishers/:id/namespaces/:id"),
  rule("POST", "/publishers/:id/apps(/projects)?"),
  rule("POST", "/publishers/:id/invites"),
  rule("PATCH DELETE", "/publishers/:id/members/:id"),
  rule("POST", "/publishers/:id/members/:id/transfer"),
  rule("POST", "/invites/:id/accept"),
  rule("DELETE", "/apps/:id"),
  rule("POST", "/apps/:id/restore"),
  rule("PATCH", "/apps/:id/hosting", (body) => "slug" in body),
  rule("POST", "/apps/:id/listing-request"),
  rule("POST DELETE", "/apps/:id/trusted-publishers(/:id)?"),
  rule("POST", "/apps/:id/tokens"),
  rule("POST", "/apps/:id/channels/:id/(invites|tokens)"),
  rule("POST", "/apps/:id/releases/:id/rollout", (body) => body.action === "rollback"),
  rule("POST", "/apps/:id/releases/:id/inside-luft"),
]

const DASHBOARD_ONLY = [
  rule("POST PATCH PUT DELETE", "/publishers/:id/verification(/.*)?"),
  rule("POST PATCH PUT DELETE", "/account(/.*)?"),
]

const pathOf = (c: Context) => c.req.path.replace(`${API_BASE}/dev`, "")

const matches = (rules: Rule[], method: string, path: string) =>
  rules.filter((entry) => entry.methods.includes(method) && entry.path.test(path))

export const approvalGuard = createMiddleware<SignedInVars>(async (c, next) => {
  if (inBrowser(c.var.signed) || c.req.method === "GET") return next()
  const path = pathOf(c)
  if (matches(DASHBOARD_ONLY, c.req.method, path).length)
    fail(403, "This is done in the dashboard, signed in in the browser")
  const needed = matches(NEEDS_APPROVAL, c.req.method, path)
  if (needed.length) {
    const body = needed.some((entry) => entry.when)
      ? ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)
      : {}
    if (needed.some((entry) => !entry.when || entry.when(body)))
      fail(403, "This needs your approval in the browser; ask for it with schelf, which opens the page")
  }
  await next()
})
