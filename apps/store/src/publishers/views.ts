import type { DashboardPublisher, Role } from "@schelf/protocol"
import { mediaUrl } from "../signing/records.ts"
import type { PublisherRow } from "./access.ts"

export function publisherView(row: PublisherRow, role: Role): DashboardPublisher {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    description: row.description,
    website: row.website,
    logo: mediaUrl(row.logoKey),
    verified: row.verifiedAt !== null,
    status: row.status,
    agreement_version: row.agreementVersion,
    role,
  }
}

export function slugFor(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}
