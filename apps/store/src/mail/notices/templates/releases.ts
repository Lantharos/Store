import { link, SUPPORT } from "../links.ts"
import { type AppSummary, app, button, type Part, paragraph, quote } from "../parts.ts"
import type { Mail } from "../render.ts"

export type ReleaseOutcome =
  | "failed"
  | "approved"
  | "changes-requested"
  | "rejected"
  | "pulled"
  | "live"
  | "inside-luft"
  | "not-inside-luft"

export interface ReleaseData extends AppSummary {
  appId: string
  releaseId: string
  publisher: string
  rolloutPercent: number
  message?: string
}

interface Copy {
  subject: string
  heading: string
  lead: string
  after?: string
  answerable?: boolean
}

function copyFor(outcome: ReleaseOutcome, { name, version, rolloutPercent }: ReleaseData): Copy {
  const release = `${name} ${version}`
  switch (outcome) {
    case "failed":
      return {
        subject: `${release} didn't pass the checks`,
        heading: `${release} didn't pass the checks`,
        lead: "One of the automatic checks failed, so this release didn't go to review. The release page shows which check it was and why.",
        after: "Fix it, publish a new version, and it goes through the checks again.",
      }
    case "approved":
      return {
        subject: `${release} is approved`,
        heading: `${release} is approved`,
        lead:
          rolloutPercent === 100
            ? `A reviewer approved it, and every device with ${name} is offered it now.`
            : `A reviewer approved it, and it's rolling out now. It starts with ${rolloutPercent}% of devices and reaches everyone over the next few days. You can pause it or send it to everyone from the release page.`,
      }
    case "changes-requested":
      return {
        subject: `${release} needs a few changes`,
        heading: `${release} needs a few changes`,
        lead: "The reviewer asked for these changes before approving it:",
        after: "Publish a new version with the changes and it goes back to review.",
        answerable: true,
      }
    case "rejected":
      return {
        subject: `${release} wasn't approved`,
        heading: `${release} wasn't approved`,
        lead: "The reviewer decided not to approve this release, for this reason:",
        after: "If something isn't clear, reply to this email and a person will get back to you.",
        answerable: true,
      }
    case "pulled":
      return {
        subject: `${release} was pulled from Schelf`,
        heading: `${release} was pulled`,
        lead: "We stopped it from being installed or opened on people's devices, for this reason:",
        after: "If you think this is a mistake, reply to this email and a person will look at it again.",
        answerable: true,
      }
    case "live":
      return {
        subject: `${release} is out to everyone`,
        heading: `${release} is out to everyone`,
        lead: `The rollout is done, so every device with ${name} is offered ${version} now.`,
      }
    case "inside-luft":
      return {
        subject: `${release} runs inside Luft`,
        heading: `${release} runs inside Luft`,
        lead: "Luft reviewed this release, so it runs inside Luft's desktop on every computer that installs it. Each new release is reviewed again.",
      }
    case "not-inside-luft":
      return {
        subject: `${release} won't run inside Luft`,
        heading: `${release} won't run inside Luft`,
        lead: "Luft reviewed this release and decided it can't run inside Luft's desktop, for this reason:",
        after:
          "It stays on Schelf, just not inside Luft's desktop. If something isn't clear, reply to this email.",
        answerable: true,
      }
  }
}

export function releaseMail(outcome: ReleaseOutcome, data: ReleaseData): Mail {
  const copy = copyFor(outcome, data)
  const body: Part[] = [app(data), paragraph(copy.lead)]
  if (data.message) body.push(quote(data.message))
  if (copy.after) body.push(paragraph(copy.after))
  body.push(button("Open the release", link(`/dashboard/apps/${data.appId}/releases/${data.releaseId}`)))
  return {
    subject: copy.subject,
    preview: copy.lead,
    heading: copy.heading,
    body,
    reason: `You got this because you're a member of ${data.publisher}, which publishes ${data.name} on Schelf.`,
    ...(copy.answerable && { replyTo: SUPPORT }),
  }
}
