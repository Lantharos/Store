import { Hono } from "hono"
import { approvalGuard } from "../approvals/guard.ts"
import { approvalRoutes } from "../approvals/routes.ts"
import { type SignedInVars, signedIn } from "../auth/session.ts"
import { domainRoutes } from "../domains/routes.ts"
import { channelAccessRoutes } from "../invited/routes.ts"
import { handleError } from "../lib/http.ts"
import { inviteRoutes } from "../publishers/invites.ts"
import { publisherRoutes } from "../publishers/routes.ts"
import { accountRoutes } from "./account/account.ts"
import { appRoutes } from "./apps/apps.ts"
import { deletingRoutes } from "./apps/deleting.ts"
import { hostingRoutes } from "./apps/hosting.ts"
import { listingRoutes } from "./apps/listing.ts"
import { mediaRoutes } from "./apps/media.ts"
import { publishingRoutes } from "./apps/publishing.ts"
import { releaseRoutes } from "./releases/releases.ts"
import { statsRoutes } from "./releases/stats.ts"

export const dashboardRoutes = new Hono<SignedInVars>()

dashboardRoutes.onError(handleError)
dashboardRoutes.use("*", signedIn)
dashboardRoutes.use("*", approvalGuard)
dashboardRoutes.route("/requests", approvalRoutes)
dashboardRoutes.route("/account", accountRoutes)
dashboardRoutes.route("/invites", inviteRoutes)
dashboardRoutes.route("/publishers", publisherRoutes)
for (const routes of [
  appRoutes,
  channelAccessRoutes,
  domainRoutes,
  deletingRoutes,
  hostingRoutes,
  listingRoutes,
  mediaRoutes,
  publishingRoutes,
  releaseRoutes,
  statsRoutes,
])
  dashboardRoutes.route("/apps", routes)
