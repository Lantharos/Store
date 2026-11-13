import { button, paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

export interface ChannelInviteData {
  inviter: { name: string; email: string }
  app: string
  channel: string
  page: string
}

export function channelInvite({ inviter, app, channel, page }: ChannelInviteData): Mail {
  return {
    subject: `${inviter.name} invited you to try ${app} early`,
    preview: `You can download ${app} from its ${channel} channel now.`,
    heading: `Try ${app} on ${channel}`,
    body: [
      paragraph(
        `${inviter.name} invited you to the ${channel} channel of ${app}. Sign in to Schelf with this address to download it from its page, or to get its updates in the Schelf app.`,
      ),
      button(`Open ${app}`, page),
      paragraph("If you weren't expecting this, you can ignore it."),
    ],
    reason: `You got this because ${inviter.name} invited this address to ${app} on Schelf.`,
    replyTo: inviter,
  }
}
