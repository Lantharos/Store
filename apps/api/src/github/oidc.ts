import { OIDC_AUDIENCE } from "@schelf/protocol"
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose"

export const GITHUB_ISSUER = "https://token.actions.githubusercontent.com"
const jwks = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`), {
  cacheMaxAge: 60 * 60_000,
  cooldownDuration: 30_000,
})

export interface WorkflowClaims {
  repository: string
  repository_id: string
  repository_owner_id: string
  workflow_ref: string
  job_workflow_ref: string
  ref: string
  sha: string
  run_id: string
  run_attempt: string
  environment?: string
}

export interface TrustedPublisherRule {
  ownerId: string
  repositoryId: string
  workflow: string
  environment: string | null
  ref: string | null
}

export async function verifyWorkflowToken(
  token: string,
  keys: JWTVerifyGetKey = jwks,
): Promise<WorkflowClaims> {
  const { payload } = await jwtVerify<JWTPayload & WorkflowClaims>(token, keys, {
    issuer: GITHUB_ISSUER,
    audience: OIDC_AUDIENCE,
    algorithms: ["RS256"],
  })
  return payload
}

export function workflowPath(claims: Pick<WorkflowClaims, "repository" | "workflow_ref">) {
  const prefix = `${claims.repository}/`
  const [path] = claims.workflow_ref.split("@")
  return path?.startsWith(prefix) ? path.slice(prefix.length) : null
}

const literal = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&")

export function matchesWorkflow(claims: WorkflowClaims, rule: TrustedPublisherRule) {
  return (
    claims.repository_id === rule.repositoryId &&
    claims.repository_owner_id === rule.ownerId &&
    workflowPath(claims) === rule.workflow &&
    (rule.environment === null || claims.environment === rule.environment)
  )
}

export function allowsRef(rule: TrustedPublisherRule, ref: string) {
  return rule.ref === null || new RegExp(`^${rule.ref.split("*").map(literal).join(".*")}$`).test(ref)
}

export function runUrl(claims: WorkflowClaims) {
  return `https://github.com/${claims.repository}/actions/runs/${claims.run_id}/attempts/${claims.run_attempt}`
}
