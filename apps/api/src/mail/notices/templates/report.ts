import type { ReportRequest } from "@schelf/protocol"
import { addressOf, REPORT_MAILBOXES } from "../../addresses.ts"
import { details, paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

const KINDS: Record<ReportRequest["kind"], string> = {
  abuse: "It's harmful",
  dsa: "It's illegal",
  dmca: "It uses your work",
  security: "A security problem",
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
    replyTo: { name: "Schelf", email: addressOf(REPORT_MAILBOXES[kind], id) },
  }
}

export function reportDecided({ app, actioned }: { app: string; actioned: boolean }): Mail {
  return {
    subject: `Your report about ${app}`,
    preview: actioned ? "We acted on it." : "We decided not to act on it.",
    heading: actioned ? "We acted on your report" : "We looked at your report",
    body: [
      paragraph(
        actioned
          ? `A person looked at your report about ${app} and acted on it.`
          : `A person looked at your report about ${app} and decided it doesn't break Schelf's rules or the law, so the app stays as it is.`,
      ),
      paragraph("If you disagree or have more to tell us, reply to this email and a person will look again."),
    ],
    reason: "You got this because you reported an app on Schelf and left this address.",
  }
}
