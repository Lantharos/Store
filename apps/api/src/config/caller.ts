import { type Ability, type ConfigChange, TOKEN_PREFIX } from "@schelf/protocol"
import { type Viewer, viewerOf } from "../auth/session.ts"
import { bearer, fail } from "../lib/http.ts"
import { appAccess } from "../publishers/access.ts"
import { identifyPublisher } from "../publishing/publisher.ts"
import type { AppRow } from "../signing/records.ts"

export type Caller =
  | { kind: "workflow"; by: string; repository: { name: string; id: string } }
  | { kind: "token"; by: string }
  | { kind: "person"; by: string; viewer: Viewer }

const isWorkflowToken = (credential: string) => credential.split(".").length === 3

const PEOPLE_ONLY = /^(domain|repository|updater|channels\.[a-z0-9-]+\.invite_only)$/

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
  const found = await viewerOf(request.headers)
  if (!found) fail(401, "That sign-in has expired; run schelf login")
  await appAccess(found.viewer, app.id)
  return { kind: "person", by: found.viewer.name, viewer: found.viewer }
}

export async function allowCaller(caller: Caller, app: AppRow, ability: Ability) {
  if (caller.kind === "person") await appAccess(caller.viewer, app.id, ability)
}

export function refusePeopleOnly(caller: Caller, changes: ConfigChange[], repositoryId: string | null) {
  if (caller.kind === "person") return
  const ownRepository = caller.kind === "workflow" && caller.repository.id === repositoryId
  const change = changes.find(
    (entry) => PEOPLE_ONLY.test(entry.key) && !(entry.key === "repository" && ownRepository),
  )
  if (change)
    fail(403, `${change.file} ${change.key}: a person changes this, with schelf apply while signed in`)
}
