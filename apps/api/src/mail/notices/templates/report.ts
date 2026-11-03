import type { ReportRequest } from "@schelf/protocol"
import { addressOf, type Mailbox } from "../../addresses.ts"
import { details, paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

const KINDS: Record<ReportRequest["kind"], string> = {
  abuse: "It's harmful",
  dsa: "It's illegal",
  dmca: "It uses your work",
  security: "A security problem",
}

const MAILBOXES: Record<ReportRequest["kind"], Mailbox> = {
  abuse: "abuse",
  dsa: "legal",
  dmca: "dmca",
  security: "security",
}

export interface ReportData {
  id: string
  app: string
  kind: ReportRequest["kind"]
}

export function reportReceived({ id, app, kind }: ReportData): Mail {
  return {
    subject: `We received your report about ${app}`,
    preview: "A person will look at it and decide what to do.",
    heading: "Thanks for your report",
    body: [
      paragraph(
        `A person will look at your report about ${app} and decide what to do. If we need more from you, or once we've acted on it, we'll write to you here.`,
      ),
      details([
        ["App", app],
        ["What you reported", KINDS[kind]],
        ["Reference", id],
      ]),
      paragraph("To add anything, reply to this email."),
    ],
    reason: "You got this because you reported an app on Schelf and left this address.",
    replyTo: { name: "Schelf", email: addressOf(MAILBOXES[kind]) },
  }
}
