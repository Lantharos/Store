import { SHIPPED_STATUSES } from "@schelf/protocol"
import type { ArtifactRow, ReleaseRow } from "../signing/records.ts"

export const REVIEWABLE: readonly ReleaseRow["status"][] = ["in-review", ...SHIPPED_STATUSES]

type ShellFields = Pick<ReleaseRow, "status" | "shellReview" | "shellFiles">

export const filesOf = (artifacts: Pick<ArtifactRow, "sha256">[]) =>
  artifacts.map((artifact) => artifact.sha256).sort()

export function runsInShell(
  release: ShellFields,
  artifacts: Pick<ArtifactRow, "sha256">[],
  verified: boolean,
) {
  return (
    verified &&
    release.shellReview === "approved" &&
    JSON.stringify(release.shellFiles) === JSON.stringify(filesOf(artifacts))
  )
}

export function shellRequestable(release: ShellFields, verified: boolean) {
  return verified && release.shellReview === null && REVIEWABLE.includes(release.status)
}
