import {
  type CheckResult,
  compareVersions,
  DEFAULT_LOCALE,
  EXTENSION_HELPER_PLATFORMS,
  EXTENSION_MANIFEST,
  extensionLabels,
  extensionWidens,
  type Format,
  formatFits,
  isProjectId,
  kindsFor,
  namespaceCovers,
  platformsFor,
  widens,
} from "@schelf/protocol"
import type { schema } from "../db/client.ts"
import type { Attestation } from "../github/attestations.ts"
import type { AppRow, ArtifactRow, ReleaseRow } from "../signing/records.ts"

export const SHIPPED_EXTENSION_APIS = [1]
const MIN_SCREENSHOTS = 2
const NAME_DISTANCE = 1

export interface QuickCheckInput {
  app: AppRow
  release: ReleaseRow
  previous: ReleaseRow | null
  artifacts: ArtifactRow[]
  attestations: Map<string, Attestation | "unverifiable" | null>
  namespaces: (typeof schema.namespace.$inferSelect)[]
  listing: (typeof schema.listing.$inferSelect)[]
  meta: typeof schema.listingMeta.$inferSelect | null
  screenshots: number
  lookalikes: { name: string; id: string }[]
}

const passed = (name: CheckResult["name"], summary: string): CheckResult => ({
  name,
  status: "passed",
  summary,
})
const warning = (name: CheckResult["name"], summary: string, detail?: unknown): CheckResult => ({
  name,
  status: "warning",
  summary,
  ...(detail === undefined ? {} : { detail }),
})
const failed = (name: CheckResult["name"], summary: string, detail?: unknown): CheckResult => ({
  name,
  status: "failed",
  summary,
  ...(detail === undefined ? {} : { detail }),
})

function namespaceCheck({ app, namespaces }: QuickCheckInput) {
  if (isProjectId(app.id)) return passed("namespace", "Named under the publisher, so no namespace to prove")
  const proven = namespaces.find((entry) => entry.verifiedAt && namespaceCovers(entry.prefix, app.id))
  return proven
    ? passed("namespace", `The ${proven.prefix} namespace is yours`)
    : failed("namespace", `Prove you own the namespace of ${app.id} in the dashboard`)
}

function versionCheck({ release, previous }: QuickCheckInput) {
  if (!previous) return passed("version", `${release.version} is the first release`)
  return compareVersions(release.version, previous.version) > 0
    ? passed("version", `${release.version} is newer than ${previous.version}`)
    : failed("version", `${release.version} isn't newer than ${previous.version}, the last approved release`)
}

function extensionPlatforms(platforms: string[], helper: boolean) {
  if (!helper)
    return platforms.every((platform) => platform === "luft")
      ? null
      : "An extension without a helper ships one luft file for every machine"
  if (platforms.includes("luft"))
    return "An extension that runs its own program ships a file per architecture, not one luft file"
  const missing = EXTENSION_HELPER_PLATFORMS.filter((platform) => !platforms.includes(platform))
  return missing.length ? `The helper needs a build for ${missing.join(" and ")} too` : null
}

function platformCheck({ app, release, artifacts }: QuickCheckInput) {
  const format = release.format
  if (!formatFits(app.kind, format)) return failed("platforms", `A ${app.kind} can't be a ${format}`)
  for (const artifact of artifacts) {
    const shape = artifact.part ? (artifact.format as Format) : format
    if (!platformsFor(shape).includes(artifact.platform as never))
      return failed("platforms", `${artifact.name} is for ${artifact.platform}, which ${shape} can't target`)
    if (!kindsFor(shape).includes(artifact.kind as never))
      return failed("platforms", `${artifact.name} is a ${artifact.kind}, which ${shape} doesn't ship`)
    if (shape === "appimage" && !artifact.platform.startsWith("linux-"))
      return failed("platforms", `${artifact.name}: AppImages are for Linux`)
    if (shape === "sabine" && artifact.kind === "archive" && !artifact.executable)
      return failed("platforms", `${artifact.name} is an archive; say which program inside it starts the app`)
  }
  const platforms = [...new Set(artifacts.filter((each) => !each.part).map((artifact) => artifact.platform))]
  const extensionProblem =
    app.kind === "extension" && extensionPlatforms(platforms, release.extensionAccess?.helper ?? false)
  if (extensionProblem) return failed("platforms", extensionProblem)
  const parts = [...new Set(artifacts.flatMap((artifact) => artifact.part ?? []))]
  const built = platforms.length ? `Built for ${platforms.join(", ")}` : "Only named parts"
  return passed("platforms", parts.length ? `${built}; parts: ${parts.join(", ")}` : built)
}

function attestationCheck({ release, artifacts, attestations }: QuickCheckInput) {
  if (release.origin === "manual")
    return warning("attestation", "Uploaded by the developer, not built on GitHub Actions")
  const missing = artifacts.filter((artifact) => attestations.get(artifact.id) === null)
  if (missing.length)
    return failed(
      "attestation",
      `No build attestation for ${missing.map((artifact) => artifact.name).join(", ")}; attest every file with actions/attest-build-provenance`,
    )
  if (artifacts.some((artifact) => attestations.get(artifact.id) === "unverifiable"))
    return warning(
      "attestation",
      "The attestations couldn't be read from GitHub, so a reviewer checks them by hand",
    )
  return passed("attestation", "Every file has a build attestation from this repository")
}

function listingCheck({ app, listing, meta, screenshots }: QuickCheckInput) {
  if (app.visibility === "unlisted") return passed("listing", "Unlisted, so the listing can wait")
  const english = listing.find((entry) => entry.locale === DEFAULT_LOCALE)
  if (!english) return failed("listing", "Add a name and summary in English")
  if (app.kind === "extension" && !meta?.iconKey)
    return failed("listing", "Add an icon in the dashboard; every extension has one")
  const missing = [
    !english.description && "a description",
    !meta?.iconKey && "an icon",
    screenshots < MIN_SCREENSHOTS && `at least ${MIN_SCREENSHOTS} screenshots`,
    !meta?.categories.length && "a category",
  ].filter(Boolean)
  return missing.length
    ? warning("listing", `The listing still needs ${missing.join(", ")}`, { missing })
    : passed("listing", "The listing is complete")
}

function extensionPermissionCheck({ release, previous }: QuickCheckInput) {
  const access = release.extensionAccess
  if (!access) return failed("permissions", `Send ${EXTENSION_MANIFEST} with the release`)
  if (previous && extensionWidens(previous.extensionAccess, access))
    return warning("permissions", "Asks for more than the last approved release", {
      before: previous.extensionAccess,
      after: access,
    })
  const asks = extensionLabels(access)
  return passed("permissions", asks.length ? asks.join(", ") : "Asks for nothing beyond the basics")
}

function permissionCheck(input: QuickCheckInput) {
  const { app, release, previous } = input
  if (app.kind === "extension") return extensionPermissionCheck(input)
  if (release.format === "sabine") return passed("permissions", "Sabine apps run with full access for now")
  if (release.format === "files")
    return passed("permissions", "Downloads run as the system they're installed on allows")
  if (!release.permissions) return warning("permissions", "Asks for full access")
  if (previous && widens(previous.permissions, release.permissions))
    return warning("permissions", "Asks for more than the last approved release", {
      before: previous.permissions,
      after: release.permissions,
    })
  return passed("permissions", previous ? "Asks for nothing new" : "Declares what it needs")
}

export function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0]!
    previous[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j]!
      previous[j] = Math.min(
        above + 1,
        previous[j - 1]! + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]!
}

function folded(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function impersonationCheck({ listing, lookalikes }: QuickCheckInput) {
  const name = listing.find((entry) => entry.locale === DEFAULT_LOCALE)?.name
  if (!name) return passed("impersonation", "No name to compare yet")
  const close = lookalikes.filter((other) => editDistance(folded(name), folded(other.name)) <= NAME_DISTANCE)
  return close.length
    ? warning(
        "impersonation",
        `The name is close to ${close.map((other) => `${other.name} (${other.id})`).join(", ")}`,
        {
          matches: close,
        },
      )
    : passed("impersonation", "No listed app has a similar name")
}

function extensionCheck({ app, release }: QuickCheckInput) {
  const api = release.requires.extension_api
  if (api === undefined) return failed("extension", "Name the extension API version in schelf.toml")
  return SHIPPED_EXTENSION_APIS.includes(api)
    ? passed("extension", `Targets extension API ${api}`)
    : failed("extension", `Extension API ${api} isn't in any Luft release yet (${app.id})`)
}

export function quickChecks(input: QuickCheckInput): CheckResult[] {
  return [
    namespaceCheck(input),
    versionCheck(input),
    platformCheck(input),
    passed("files", "Every file matches its SHA-256"),
    attestationCheck(input),
    listingCheck(input),
    permissionCheck(input),
    impersonationCheck(input),
    ...(input.app.kind === "extension" ? [extensionCheck(input)] : []),
  ]
}
