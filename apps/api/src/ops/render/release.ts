import { b } from "@lantharos/pult"
import { CHECK_TITLES } from "@schelf/protocol"
import { fileUrl } from "../../signing/records.ts"
import { CHECK_RESULT, ORIGIN, RELEASE_STATUS, SOURCE, VISIBILITY } from "../data/labels.ts"
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
    tag: release.tag ?? undefined,
  }
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
