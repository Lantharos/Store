import type { ReleaseStatus } from "@schelf/protocol"

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
