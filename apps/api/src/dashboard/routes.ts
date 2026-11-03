import { Hono } from "hono"
import { asDeveloper, type DeveloperVars, signedIn } from "../auth/session.ts"
import { accountRoutes } from "./account/account.ts"
import { namespaceRoutes } from "./account/namespaces.ts"
import { appRoutes } from "./apps/apps.ts"
import { listingRoutes } from "./apps/listing.ts"
import { mediaRoutes } from "./apps/media.ts"
import { publishingRoutes } from "./apps/publishing.ts"
import { releaseRoutes } from "./releases/releases.ts"
import { statsRoutes } from "./releases/stats.ts"

export const dashboardRoutes = new Hono<DeveloperVars>()

dashboardRoutes.use("*", signedIn)
dashboardRoutes.route("/account", accountRoutes)
dashboardRoutes.use("*", asDeveloper)
dashboardRoutes.route("/namespaces", namespaceRoutes)
for (const routes of [appRoutes, listingRoutes, mediaRoutes, publishingRoutes, releaseRoutes, statsRoutes])
  dashboardRoutes.route("/apps", routes)
