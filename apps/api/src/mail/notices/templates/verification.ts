import { link, SUPPORT } from "../links.ts"
import { button, paragraph, quote } from "../parts.ts"
import type { Mail } from "../render.ts"

export type VerificationOutcome = "approved" | "rejected" | "more-requested" | "message" | "revoked"

export interface VerificationData {
  publisherId: string
  name: string
  slug: string
  message?: string
}

type Content = Pick<Mail, "subject" | "heading" | "body">

function contentFor(
  outcome: VerificationOutcome,
  { name, publisherId, slug, message }: VerificationData,
): Content {
  const dashboard = link(`/dashboard/settings/verification?publisher=${publisherId}`)
  const said = message ? [quote(message)] : []
  switch (outcome) {
    case "approved":
      return {
        subject: `${name} is verified on Schelf`,
        heading: `${name} is verified`,
        body: [
          paragraph(
            `Your publisher page, your app pages and the Schelf app now show the verified mark next to ${name}, so people know we checked who's behind your apps.`,
          ),
          button("View your publisher page", link(`/publishers/${slug}`)),
        ],
      }
    case "rejected":
      return {
        subject: `${name} wasn't verified`,
        heading: `We couldn't verify ${name}`,
        body: [
          paragraph("The reviewer decided not to verify it this time, for this reason:"),
          ...said,
          paragraph("Once you've sorted it out, you can start a new request from the dashboard."),
          button("Open verification", dashboard),
        ],
      }
    case "more-requested":
      return {
        subject: `Schelf needs a little more to verify ${name}`,
        heading: `A little more to verify ${name}`,
        body: [
          paragraph("The reviewer needs a bit more before deciding:"),
          ...said,
          paragraph("Answer in the dashboard and the reviewer picks it up from there."),
          button("Answer the reviewer", dashboard),
        ],
      }
    case "message":
      return {
        subject: `A message about verifying ${name}`,
        heading: `A message about verifying ${name}`,
        body: [
          paragraph("The reviewer wrote:"),
          ...said,
          paragraph("You can answer in the dashboard."),
          button("Open verification", dashboard),
        ],
      }
    case "revoked":
      return {
        subject: `${name} is no longer verified on Schelf`,
        heading: `${name} is no longer verified`,
        body: [
          paragraph("We removed the verified mark from your pages, for this reason:"),
          ...said,
          paragraph(
            "If you think this is a mistake, reply to this email and a person will look at it again.",
          ),
          button("Open verification", dashboard),
        ],
      }
  }
}

export function verificationMail(outcome: VerificationOutcome, data: VerificationData): Mail {
  const { subject, heading, body } = contentFor(outcome, data)
  return {
    subject,
    preview: body[0]!.text,
    heading,
    body,
    reason: `You got this because you're an owner of ${data.name} on Schelf.`,
    replyTo: SUPPORT,
  }
}
