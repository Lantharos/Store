import { type HostedRelease, INVITED_PREFIX } from "@schelf/protocol"
import { equalStrings, hmac } from "../lib/hmac.ts"
import { fileUrl } from "../signing/records.ts"

const LINK_MINUTES = 60

export const isInvitedKey = (key: string) => key.startsWith(INVITED_PREFIX)

const fileMessage = (key: string, expires: number) => `invited-file:${key}:${expires}`

export async function signedFileUrl(key: string, minutes = LINK_MINUTES) {
  const expires = Date.now() + minutes * 60_000
  const url = new URL(fileUrl(key))
  url.searchParams.set("expires", String(expires))
  url.searchParams.set("access", await hmac(fileMessage(key, expires)))
  return url.href
}

export const fileLink = (key: string) => (isInvitedKey(key) ? signedFileUrl(key) : fileUrl(key))

const keyOfUrl = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1))

export function signReleases(releases: HostedRelease[]) {
  return Promise.all(
    releases.map(async (release) => ({
      ...release,
      files: await Promise.all(
        release.files.map(async (file) => ({ ...file, url: await fileLink(keyOfUrl(file.url)) })),
      ),
    })),
  )
}

export async function signedFor(url: URL, key: string) {
  const expires = Number(url.searchParams.get("expires"))
  const access = url.searchParams.get("access")
  return !!access && expires > Date.now() && equalStrings(access, await hmac(fileMessage(key, expires)))
}
