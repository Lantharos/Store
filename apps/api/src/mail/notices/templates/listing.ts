import { link, SUPPORT } from "../links.ts"
import { button, type Part, paragraph, quote } from "../parts.ts"
import type { Mail } from "../render.ts"

export interface ListingDecision {
  appId: string
  name: string
  publisher: string
  listed: boolean
  reason?: string
}

export function listingMail(data: ListingDecision): Mail {
  const heading = data.listed ? `${data.name} is listed on Schelf` : `${data.name} stays unlisted for now`
  const lead = data.listed
    ? "A reviewer looked at it, and it now shows up in the catalog, in search and in the Schelf app."
    : "A reviewer looked at it and decided not to list it yet, for this reason:"
  const body: Part[] = [paragraph(lead)]
  if (data.reason) body.push(quote(data.reason))
  if (!data.listed)
    body.push(
      paragraph(
        "Its page, download links and updates keep working. Ask again from the dashboard once it's ready.",
      ),
    )
  body.push(button("Open the project", link(`/dashboard/apps/${data.appId}`)))
  return {
    subject: heading,
    preview: lead,
    heading,
    body,
    reason: `You got this because you're a member of ${data.publisher}, which publishes ${data.name} on Schelf.`,
    ...(!data.listed && { replyTo: SUPPORT }),
  }
}
