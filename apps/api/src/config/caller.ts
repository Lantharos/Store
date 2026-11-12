import { type Ability, TOKEN_PREFIX } from "@schelf/protocol"
import { auth } from "../auth/auth.ts"
import type { Viewer } from "../auth/session.ts"
import { bearer, fail } from "../lib/http.ts"
import { appAccess } from "../publishers/access.ts"
import { identifyPublisher } from "../publishing/publisher.ts"
import type { AppRow } from "../signing/records.ts"

export type Caller =
  | { kind: "workflow"; by: string; repository: { name: string; id: string } }
  | { kind: "token"; by: string }
  | { kind: "person"; by: string; viewer: Viewer }

const isWorkflowToken = (credential: string) => credential.split(".").length === 3

export async function callerOf(request: Request, app: AppRow): Promise<Caller> {
  const credential = bearer(request)
  if (!credential) fail(401, "Sign in with schelf login, or apply from a trusted workflow")
  if (credential.startsWith(TOKEN_PREFIX) || isWorkflowToken(credential)) {
    const publisher = await identifyPublisher(credential, app)
    if (publisher.origin === "oidc")
      return {
        kind: "workflow",
        by: `${publisher.claims.repository} (${publisher.workflow})`,
        repository: { name: publisher.claims.repository, id: publisher.claims.repository_id },
      }
    return { kind: "token", by: "an upload token" }
  }
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) fail(401, "That sign-in has expired; run schelf login")
  const viewer = { ...session.user, image: session.user.image ?? null }
  await appAccess(viewer, app.id)
  return { kind: "person", by: viewer.name, viewer }
}

export async function allowCaller(caller: Caller, app: AppRow, ability: Ability) {
  if (caller.kind === "person") await appAccess(caller.viewer, app.id, ability)
}
