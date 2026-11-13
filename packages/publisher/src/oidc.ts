import { OIDC_AUDIENCE } from "@schelf/protocol"

export async function githubOidcToken(audience = OIDC_AUDIENCE) {
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL!)
  url.searchParams.set("audience", audience)
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
  })
  if (!response.ok) {
    throw new Error(
      `GitHub refused an identity token (${response.status}). The job needs permissions: id-token: write.`,
    )
  }
  return ((await response.json()) as { value: string }).value
}
