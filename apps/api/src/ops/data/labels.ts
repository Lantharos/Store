import type {
  AppStatus,
  CheckStatus,
  PublisherKind,
  REPORT_KINDS,
  ReleaseStatus,
  Role,
  ShellReview,
  VerificationEventKind,
  VerificationStatus,
} from "@schelf/protocol"

export const APP_STATUS: Record<AppStatus, string> = {
  draft: "Not submitted",
  "in-review": "In review",
  published: "Published",
  delisted: "Delisted",
  pulled: "Pulled",
  deleted: "Deleted by the publisher",
}

export const APP_KIND = { app: "App", extension: "Luft extension" } as const

export const APP_FORMAT = {
  sabine: "Sabine",
  appimage: "AppImage",
  "luft-extension": "Luft extension",
  files: "Files",
} as const

export const VISIBILITY = { listed: "Listed", unlisted: "Unlisted" } as const

export const SOURCE = { open: "Open source", proprietary: "Closed source" } as const

export const ORIGIN = { oidc: "Built on GitHub Actions", manual: "Uploaded by the developer" } as const

export const SHELL_REVIEW: Record<ShellReview, string> = {
  waiting: "Asked to run inside Luft",
  approved: "Runs inside Luft",
  refused: "Refused to run inside Luft",
}

export const RELEASE_STATUS: Record<ReleaseStatus, string> = {
  uploading: "Uploading",
  checking: "Being checked",
  failed: "Failed its checks",
  "in-review": "In review",
  "changes-requested": "Changes requested",
  rejected: "Rejected",
  "rolling-out": "Rolling out",
  live: "Live",
  withdrawn: "Rolled back",
  pulled: "Pulled",
}

export const CHECK_RESULT: Record<CheckStatus, string> = {
  passed: "Passed",
  warning: "Warning",
  failed: "Failed",
}

export const PUBLISHER_KIND: Record<PublisherKind, string> = {
  person: "Person",
  organisation: "Organisation",
}

export const PUBLISHER_STATUS = { active: "Active", suspended: "Suspended" } as const

export const ROLE: Record<Role, string> = { owner: "Owner", admin: "Admin", developer: "Developer" }

export const NAMESPACE_PROOF = {
  dns: "DNS record",
  "well-known": "File on the website",
  github: "GitHub account",
  manual: "Granted by Schelf",
} as const

export const VERIFICATION_STATUS: Record<VerificationStatus, string> = {
  draft: "Being written",
  open: "Waiting for review",
  "more-requested": "Waiting for the publisher",
  approved: "Verified",
  rejected: "Declined",
  revoked: "Revoked",
}

export const VERIFICATION_EVENT: Record<VerificationEventKind, string> = {
  submitted: "Sent the request",
  checked: "Checks ran",
  "more-requested": "Asked for more",
  replied: "Answered",
  message: "Sent a message",
  approved: "Verified",
  rejected: "Declined",
  revoked: "Revoked",
}

export const REPORT_KIND: Record<(typeof REPORT_KINDS)[number], string> = {
  abuse: "Harmful",
  dsa: "Illegal",
  dmca: "Uses someone's work",
  security: "Security problem",
}
