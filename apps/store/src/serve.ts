import { env } from "cloudflare:workers"
import { API_BASE } from "@schelf/protocol"
import { Hono } from "hono"
import { authRoutes } from "./auth/routes.ts"
import { avatarRoutes } from "./avatars/github.ts"
import { configRoutes } from "./config/routes.ts"
import { dashboardRoutes } from "./dashboard/routes.ts"
import { serveDomain } from "./domains/serve.ts"
import { serveDownload } from "./downloads/serve.ts"
import { invitedRoutes } from "./invited/people.ts"
import { fail, handleError } from "./lib/http.ts"
import { backOffice } from "./ops/pult.ts"
import { publishingRoutes } from "./publishing/routes.ts"
import { storefrontRoutes } from "./storefront/routes.ts"
import { installRoutes } from "./tools/install/route.ts"

const downloadHost = new URL(env.DOWNLOAD_URL).hostname
export const storeHost = new URL(env.PUBLIC_URL).hostname

const app = new Hono()

app.onError(handleError)

app.use("/api/*", async (_, next) => {
  if (!env.BETTER_AUTH_SECRET || !env.UPLOAD_SECRET || !env.STORE_SIGNING_KEY)
    fail(503, "schelf.store isn't configured yet")
  await next()
})

app.route("/api/auth", authRoutes)
app.post("/api/ops", (c) => {
  const office = backOffice()
  if (!office) fail(404, "Not found")
  return office.handle(c.req.raw, c.executionCtx)
})
app.route(`${API_BASE}/avatars`, avatarRoutes)
app.route(API_BASE, storefrontRoutes)
app.route(API_BASE, invitedRoutes)
app.route(API_BASE, publishingRoutes)
app.route(API_BASE, configRoutes)
app.route(`${API_BASE}/dev`, dashboardRoutes)
app.route("/", installRoutes)
app.all("*", () => fail(404, "Not found"))

export function serve(request: Request, context?: ExecutionContext) {
  const host = new URL(request.url).hostname
  if (host === downloadHost) return serveDownload(request)
  if (host !== storeHost) return serveDomain(request)
  return app.fetch(request, env, context)
}
