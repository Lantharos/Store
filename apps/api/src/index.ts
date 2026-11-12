import { env } from "cloudflare:workers"
import { API_BASE } from "@schelf/protocol"
import { Hono } from "hono"
import { authRoutes } from "./auth/routes.ts"
import { avatarRoutes } from "./avatars/github.ts"
import { configRoutes } from "./config/routes.ts"
import { recheckNamespaces } from "./dashboard/account/namespaces.ts"
import { dashboardRoutes } from "./dashboard/routes.ts"
import { rollUpDownloads } from "./downloads/rollup.ts"
import { serveDownload } from "./downloads/serve.ts"
import { pruneChannels } from "./hosting/channels.ts"
import { purgeDeleted } from "./hosting/deletion.ts"
import { errorResponse, fail } from "./lib/http.ts"
import { receiveMail } from "./mail/receive.ts"
import { deliverPending } from "./ops/pending.ts"
import { backOffice, publishDefinitions } from "./ops/pult.ts"
import { publishingRoutes } from "./publishing/routes.ts"
import { restartStalledChecks } from "./releases/checks.ts"
import { stepRollouts } from "./releases/rollout.ts"
import { resignEverything, resignIfRequested, type SigningJob, signQueued } from "./signing/queue.ts"
import { storefrontRoutes } from "./storefront/routes.ts"

const HOURLY = "0 * * * *"
const downloadHost = new URL(env.DOWNLOAD_URL).hostname

const app = new Hono()

app.onError((error, c) => {
  const known = errorResponse(error)
  if (known) return known
  console.error(error)
  return c.json({ error: "Something went wrong" }, 500)
})

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
app.route(API_BASE, publishingRoutes)
app.route(API_BASE, configRoutes)
app.route(`${API_BASE}/dev`, dashboardRoutes)
app.all("*", () => fail(404, "Not found"))

export default {
  fetch(request, environment, context) {
    context.waitUntil(publishDefinitions())
    if (new URL(request.url).hostname === downloadHost) return serveDownload(request)
    return app.fetch(request, environment, context)
  },
  async scheduled(controller) {
    if (controller.cron === HOURLY) {
      const office = backOffice()
      await Promise.all([
        stepRollouts(),
        restartStalledChecks(),
        pruneChannels(),
        resignIfRequested(),
        publishDefinitions(),
        office && deliverPending(office.pult),
      ])
      return
    }
    await Promise.all([rollUpDownloads(), recheckNamespaces(), purgeDeleted(), resignEverything()])
  },
  queue: (batch) => signQueued(batch as MessageBatch<SigningJob>),
  email: receiveMail,
} satisfies ExportedHandler<Env, SigningJob>
