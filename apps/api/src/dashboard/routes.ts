import { Hono } from "hono"
import { type SignedInVars, signedIn } from "../auth/session.ts"
import { inviteRoutes } from "../publishers/invites.ts"
import { publisherRoutes } from "../publishers/routes.ts"
import { accountRoutes } from "./account/account.ts"
import { appRoutes } from "./apps/apps.ts"
import { hostingRoutes } from "./apps/hosting.ts"
import { listingRoutes } from "./apps/listing.ts"
import { mediaRoutes } from "./apps/media.ts"
import { publishingRoutes } from "./apps/publishing.ts"
import { releaseRoutes } from "./releases/releases.ts"
import { statsRoutes } from "./releases/stats.ts"

export const dashboardRoutes = new Hono<SignedInVars>()

dashboardRoutes.use("*", signedIn)
dashboardRoutes.route("/account", accountRoutes)
dashboardRoutes.route("/invites", inviteRoutes)
dashboardRoutes.route("/publishers", publisherRoutes)
for (const routes of [
  appRoutes,
  hostingRoutes,
  listingRoutes,
  mediaRoutes,
  publishingRoutes,
  releaseRoutes,
  statsRoutes,
])
  dashboardRoutes.route("/apps", routes)
