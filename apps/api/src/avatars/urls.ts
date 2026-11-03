import { env } from "cloudflare:workers"
import { type Account, API_BASE, type AvatarSource } from "@schelf/protocol"
import { mediaUrl } from "../signing/records.ts"

interface AvatarFields {
  githubId: string | null
  avatarKey: string | null
  avatar: AvatarSource
}

export const githubAvatar = (who: string) => `${env.PUBLIC_URL}${API_BASE}/avatars/github/${who}`

export function avatarChoices(user: AvatarFields): Account["avatars"] {
  return {
    using: user.avatar,
    github: user.githubId ? githubAvatar(user.githubId) : null,
    upload: mediaUrl(user.avatarKey),
  }
}

export function avatarUrl(user: AvatarFields) {
  const choices = avatarChoices(user)
  return choices.using === "upload" ? choices.upload : choices.github
}
