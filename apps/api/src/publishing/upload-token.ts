import { UPLOAD_TOKEN_HOURS } from "@schelf/protocol"
import { equalStrings, hmac } from "../lib/hmac.ts"
import { fail } from "../lib/http.ts"
import { HOUR_MS } from "../lib/time.ts"

export async function issueUploadToken(release: string, now = Date.now()) {
  const expires = now + UPLOAD_TOKEN_HOURS * HOUR_MS
  return { token: `${release}.${expires}.${await hmac(`${release}.${expires}`)}`, expires: new Date(expires) }
}

export async function checkUploadToken(token: string | null, release: string) {
  const [id, expires, signature] = token?.split(".") ?? []
  if (!id || !expires || !signature || id !== release) fail(401, "That upload token isn't for this release")
  if (!equalStrings(signature, await hmac(`${id}.${expires}`))) fail(401, "That upload token isn't valid")
  if (Number(expires) < Date.now()) fail(401, "That upload token has expired; publish again")
}
