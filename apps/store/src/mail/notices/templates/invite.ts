import { link } from "../links.ts"
import { button, details, paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

export interface InviteData {
  inviter: EmailAddress
  publisher: string
  role: string
  githubLogin: string | null
  expires: Date
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a")

const day = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

export function invite({
  inviter: { name: inviter, email: inviterEmail },
  publisher,
  role,
  githubLogin,
  expires,
}: InviteData): Mail {
  const signIn = githubLogin
    ? `Sign in with this address or with the GitHub account ${githubLogin} to accept.`
    : "Sign in with this address to accept."
  return {
    subject: `${inviter} invited you to ${publisher} on Schelf`,
    preview: `Join ${publisher} as ${article(role)} ${role.toLowerCase()} and publish apps together.`,
    heading: `Join ${publisher} on Schelf`,
    body: [
      paragraph(
        `${inviter} invited you to publish apps as ${publisher}, as ${article(role)} ${role.toLowerCase()}. ${signIn}`,
      ),
      button("See the invitation", link("/dashboard/invites")),
      details([
        ["Organisation", publisher],
        ["Invited by", inviter],
        ["Role", role],
        ["Open until", day(expires)],
      ]),
      paragraph("If you weren't expecting this, you can ignore it and the invitation runs out on its own."),
    ],
    reason: `You got this because ${inviter} invited this address to ${publisher} on Schelf.`,
    replyTo: { name: inviter, email: inviterEmail },
  }
}
