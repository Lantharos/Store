import { b } from "@lantharos/pult"
import { CHECK_TITLES, extensionLabels, luftVersionLabel } from "@schelf/protocol"
import { fileUrl } from "../../signing/records.ts"
import { CHECK_RESULT, ORIGIN, RELEASE_STATUS, SHELL_REVIEW, SOURCE, VISIBILITY } from "../data/labels.ts"
import { appPage, link } from "../data/links.ts"
import { type ReleaseView, releases } from "../data/releases.ts"
import { checkDetailBlocks, factBlocks } from "./facts.ts"
import { listingBlocks } from "./listing.ts"

const DECISION = { approved: "Approved", "changes-requested": "Asked for changes", rejected: "Rejected" }

export function releaseState(release: ReleaseView) {
  const status = RELEASE_STATUS[release.status]
  if (release.status === "rolling-out")
    return `${status} to ${release.rolloutPercent}%${release.rolloutPaused ? ", paused" : ""}`
  return status
}

function megabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function provenance(release: ReleaseView) {
  if (release.origin === "manual") return { built: ORIGIN.manual }
  return {
    built: ORIGIN.oidc,
    workflow: release.workflow ?? undefined,
    run: link(release.runUrl, "Build run"),
    commit:
      release.commit && release.repository
        ? b.link(
            `https://github.com/${release.repository}/commit/${release.commit}`,
            release.commit.slice(0, 12),
          )
        : undefined,
    ref: release.ref ?? undefined,
  }
}

function extensionFields(release: ReleaseView) {
  if (release.kind !== "extension") return {}
  return {
    "needs Luft": release.luftMinimum ? `${luftVersionLabel(release.luftMinimum)} or newer` : "Any",
    "inside Luft": release.shellReview ? SHELL_REVIEW[release.shellReview] : "Not asked for",
    "refused because": release.shellReview === "refused" ? (release.shellReason ?? undefined) : undefined,
    "can do": release.extensionAccess
      ? extensionLabels(release.extensionAccess).join(", ") || "Nothing beyond the basics"
      : undefined,
  }
}

export async function shellBlocks(release: ReleaseView) {
  return [
    b.markdown(
      release.publisherVerified
        ? "Approving lets these exact files run inside Luft's desktop, in Kestrel's own process, where the permissions describe the API but don't wall it off. Read the source changes and the helper, if there is one, before you approve."
        : "The publisher isn't verified any more, so this release can't run inside Luft whatever is decided here.",
    ),
    ...(await releaseBlocks(release)),
  ]
}

export async function releaseBlocks(release: ReleaseView) {
  const [checks, artifacts, reviews, block] = await Promise.all([
    releases.checks(release.id),
    releases.artifacts(release.id),
    releases.reviews(release.id),
    release.status === "pulled" ? releases.activeBlock(release.id) : undefined,
  ])
  const decided = reviews.filter((review) => review.decision)
  return [
    b.fields({
      app: b.ref("app", release.appId, release.name),
      publisher: b.ref("publisher", release.publisherId, release.publisher),
      verified: release.publisherVerified,
      version: release.version,
      channel: release.channel === "stable" ? undefined : release.channel,
      project: `${VISIBILITY[release.visibility]}, ${SOURCE[release.distribution].toLowerCase()}`,
      updates: release.bridge
        ? "Bridge: the last build in the old framework, handing over to the new one"
        : undefined,
      "promoted from": release.promotedFrom ? b.ref("release", release.promotedFrom) : undefined,
      status: releaseState(release),
      "pulled because": block?.reason,
      "public note": block?.publicNote ?? undefined,
      ...provenance(release),
      ...extensionFields(release),
      "wider permissions": release.permissionsWidened ? "Asks for more than the release before" : undefined,
      approved: release.approvedAt
        ? `${release.approvedAt.toISOString().slice(0, 10)} by ${release.approvedBy}`
        : undefined,
      "store page": link(
        appPage({ ...release, id: release.appId, status: release.appStatus }, release.publisherSlug),
      ),
    }),
    checks.length && checks.every((check) => check.status === "passed")
      ? b.fields({ checks: `All ${checks.length} passed` })
      : b.table(
          checks.map((check) => ({
            check: CHECK_TITLES[check.name],
            result: CHECK_RESULT[check.status],
            summary: check.summary,
          })),
          { title: "Checks" },
        ),
    ...(await checkDetailBlocks(checks)),
    b.table(
      artifacts.map((artifact) => ({
        file: b.link(fileUrl(artifact.key), artifact.name),
        system: artifact.platform,
        kind: artifact.kind,
        size: megabytes(artifact.size),
        attestation: artifact.attestationUrl ? b.link(artifact.attestationUrl, "Verified") : "None",
      })),
      { title: "Files" },
    ),
    b.table(
      decided.map((review) => ({
        decision: DECISION[review.decision!],
        by: review.decidedBy ?? "",
        when: review.decidedAt ?? undefined,
        reason: review.reason ?? "",
      })),
      { title: "Decisions" },
    ),
    ...(release.permissions
      ? [b.code(JSON.stringify(release.permissions, null, 2), { lang: "json", title: "Permissions" })]
      : []),
    ...(release.notes ? [b.markdown(`**Release notes**\n\n${release.notes}`)] : []),
    ...(await factBlocks(release)),
    ...(await listingBlocks(release.appId)),
  ]
}
