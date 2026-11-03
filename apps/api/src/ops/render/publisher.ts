import { b } from "@lantharos/pult"
import type { VerificationEventKind } from "@schelf/protocol"
import { installsSince } from "../../signing/records.ts"
import { apps } from "../data/apps.ts"
import {
  NAMESPACE_PROOF,
  PUBLISHER_KIND,
  PUBLISHER_STATUS,
  ROLE,
  VERIFICATION_EVENT,
  VERIFICATION_STATUS,
} from "../data/labels.ts"
import { link, publisherPage, repositoryLink } from "../data/links.ts"
import { type PublisherView, publishers } from "../data/publishers.ts"

export function emailHint(email: string) {
  const [name, domain] = email.split("@")
  return `${name![0]}…@${domain}`
}

function verifiedState(publisher: PublisherView) {
  if (publisher.verifiedAt) return publisher.verifiedAt
  return publisher.verification ? VERIFICATION_STATUS[publisher.verification] : "Never asked"
}

function eventText(event: { kind: VerificationEventKind; by: string | null; text: string | null }) {
  const what = event.by ? `${VERIFICATION_EVENT[event.kind]} (${event.by})` : VERIFICATION_EVENT[event.kind]
  return event.text ? `${what}: ${event.text}` : what
}

export async function publisherBlocks(publisher: PublisherView) {
  const [members, namespaces, trusted, tokens, history, owned] = await Promise.all([
    publishers.members(publisher.id),
    publishers.namespaces(publisher.id),
    publishers.trustedPublishers(publisher.id),
    publishers.activeTokens(publisher.id),
    publishers.verificationHistory(publisher.id),
    apps.ofPublisher(publisher.id),
  ])
  const installs = await installsSince(
    owned.map((app) => app.id),
    30,
  )
  return [
    b.stats({
      Apps: owned.length,
      Listed: owned.filter((app) => app.status === "listed").length,
      "Installs, 30 days": [...installs.values()].reduce((sum, count) => sum + count, 0),
    }),
    b.fields({
      name: publisher.name,
      kind: PUBLISHER_KIND[publisher.kind],
      owner: publisher.owner,
      status: PUBLISHER_STATUS[publisher.status],
      verified: verifiedState(publisher),
      website: link(publisher.website),
      agreement: `${publisher.agreementVersion}, accepted ${publisher.agreementAt.toISOString().slice(0, 10)}`,
      joined: publisher.createdAt,
      "store page": b.link(publisherPage(publisher), `schelf.store/publishers/${publisher.slug}`),
    }),
    b.table(
      members.map((member) => ({
        member: member.name,
        email: b.sensitive(member.email, { hint: emailHint(member.email) }),
        github: member.github ? b.link(`https://github.com/${member.github}`, member.github) : "",
        role: ROLE[member.role],
        joined: member.joined,
      })),
      { title: "Members" },
    ),
    b.table(
      namespaces.map((entry) => ({
        namespace: entry.prefix,
        proof: entry.proof ? NAMESPACE_PROOF[entry.proof] : "Not proven yet",
        proven: entry.verifiedAt ?? "",
        "last checked": entry.checkedAt ?? "",
      })),
      { title: "Namespaces" },
    ),
    b.table(
      trusted.map(({ rule, app }) => ({
        app: b.ref("app", app, app),
        repository: repositoryLink(rule.repository),
        workflow: rule.workflow,
        environment: rule.environment ?? "Any",
      })),
      { title: "Trusted publishers" },
    ),
    b.table(
      tokens.map((token) => ({
        app: b.ref("app", token.appId, token.appId),
        token: token.name,
        "last used": token.lastUsedAt ?? "Never",
        expires: token.expiresAt,
      })),
      { title: "Tokens" },
    ),
    ...(history.length
      ? [
          b.markdown("**Verification**"),
          b.timeline(history.map((event) => ({ at: event.at, text: eventText(event) }))),
        ]
      : []),
  ]
}
