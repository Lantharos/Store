import { OIDC_AUDIENCE } from "@schelf/protocol"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import { describe, expect, test } from "vitest"
import {
  allowsRef,
  GITHUB_ISSUER,
  matchesWorkflow,
  verifyWorkflowToken,
  type WorkflowClaims,
} from "../src/github/oidc.ts"

const claims: WorkflowClaims = {
  repository: "mira/notes",
  repository_id: "123",
  repository_owner_id: "45",
  workflow_ref: "mira/notes/.github/workflows/schelf.yml@refs/heads/main",
  job_workflow_ref: "mira/notes/.github/workflows/schelf.yml@refs/heads/main",
  ref: "refs/heads/main",
  sha: "a".repeat(40),
  run_id: "9",
  run_attempt: "1",
}

const rule = {
  ownerId: "45",
  repositoryId: "123",
  workflow: ".github/workflows/schelf.yml",
  environment: null,
  ref: null,
}

async function signer() {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k", alg: "RS256" }] })
  const sign = (payload: object, { audience = OIDC_AUDIENCE, issuer = GITHUB_ISSUER, expires = "5m" } = {}) =>
    new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "RS256", kid: "k" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey)
  return { keys, sign }
}

describe("GitHub identity tokens", () => {
  test("only tokens GitHub issued for schelf.store and still valid are accepted", async () => {
    const { keys, sign } = await signer()
    expect((await verifyWorkflowToken(await sign(claims), keys)).repository_id).toBe("123")
    await expect(verifyWorkflowToken(await sign(claims, { audience: "pypi" }), keys)).rejects.toThrow()
    await expect(
      verifyWorkflowToken(await sign(claims, { issuer: "https://example.com" }), keys),
    ).rejects.toThrow()
    await expect(verifyWorkflowToken(await sign(claims, { expires: "-1m" }), keys)).rejects.toThrow()
    const stranger = await signer()
    await expect(verifyWorkflowToken(await stranger.sign(claims), keys)).rejects.toThrow()
  })
})

describe("trusted publishers", () => {
  test("match the registered repository, owner and workflow by id", () => {
    expect(matchesWorkflow(claims, rule)).toBe(true)
    expect(matchesWorkflow({ ...claims, repository_id: "999" }, rule)).toBe(false)
    expect(matchesWorkflow({ ...claims, repository_owner_id: "999" }, rule)).toBe(false)
    expect(
      matchesWorkflow(
        { ...claims, workflow_ref: "mira/notes/.github/workflows/other.yml@refs/heads/main" },
        rule,
      ),
    ).toBe(false)
  })

  test("a workflow in another repository with the same path doesn't match", () => {
    expect(
      matchesWorkflow(
        { ...claims, workflow_ref: "eve/notes/.github/workflows/schelf.yml@refs/heads/main" },
        rule,
      ),
    ).toBe(false)
  })

  test("a renamed repository keeps publishing because ids match", () => {
    expect(
      matchesWorkflow(
        {
          ...claims,
          repository: "mira/notebook",
          workflow_ref: "mira/notebook/.github/workflows/schelf.yml@refs/heads/main",
        },
        rule,
      ),
    ).toBe(true)
  })

  test("an environment rule needs that environment", () => {
    const guarded = { ...rule, environment: "release" }
    expect(matchesWorkflow(claims, guarded)).toBe(false)
    expect(matchesWorkflow({ ...claims, environment: "release" }, guarded)).toBe(true)
  })

  test("any branch or tag publishes unless the rule names refs", () => {
    expect(allowsRef(rule, "refs/heads/feature")).toBe(true)
    const main = { ...rule, ref: "refs/heads/main" }
    expect(allowsRef(main, "refs/heads/main")).toBe(true)
    expect(allowsRef(main, "refs/heads/main-old")).toBe(false)
    expect(allowsRef(main, "refs/tags/v1.2.0")).toBe(false)
    const tags = { ...rule, ref: "refs/tags/v*" }
    expect(allowsRef(tags, "refs/tags/v1.2.0")).toBe(true)
    expect(allowsRef(tags, "refs/heads/v1")).toBe(false)
    expect(allowsRef({ ...rule, ref: "refs/heads/release.1" }, "refs/heads/releasex1")).toBe(false)
  })
})
