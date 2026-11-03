import type { CheckName, ReleaseStatus } from "@schelf/protocol"

export type Tone = "done" | "active" | "attention" | "quiet"

export const RELEASE_STATUS: Record<ReleaseStatus, { label: string; tone: Tone }> = {
  uploading: { label: "Uploading", tone: "active" },
  checking: { label: "Checking", tone: "active" },
  failed: { label: "Needs a fix", tone: "attention" },
  "in-review": { label: "In review", tone: "active" },
  "changes-requested": { label: "Changes requested", tone: "attention" },
  rejected: { label: "Rejected", tone: "attention" },
  "rolling-out": { label: "Rolling out", tone: "active" },
  live: { label: "Live", tone: "done" },
  withdrawn: { label: "Withdrawn", tone: "quiet" },
  pulled: { label: "Stopped by Schelf", tone: "attention" },
}

export const TONE_DOT: Record<Tone, string> = {
  done: "bg-accent",
  active: "bg-caution",
  attention: "bg-danger",
  quiet: "bg-ink-muted/50",
}

export const CHECK_TITLES: Record<CheckName, string> = {
  namespace: "Namespace",
  version: "Version",
  platforms: "Systems",
  files: "Files",
  attestation: "Build provenance",
  listing: "Listing",
  permissions: "Permissions",
  impersonation: "Name and icon",
  extension: "Extension manifest",
  malware: "Malware scan",
  inspection: "What the app can do",
  diff: "Source changes",
  licence: "Licence",
}
