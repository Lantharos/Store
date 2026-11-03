import { stat } from "node:fs/promises"
import { join } from "node:path"
import {
  type AppIndex,
  type ArtifactKind,
  appIndex,
  compareVersions,
  type DeltaReport,
  downloadUrl,
  type Format,
  paths,
} from "@schelf/protocol"
import { download } from "./download.ts"
import { runChecked } from "./run.ts"

const PREVIOUS_RELEASES = 3
const WORTHWHILE_SHARE = 0.6
const UPDATED_KIND: Record<Format, ArtifactKind> = {
  sabine: "archive",
  appimage: "appimage",
  "luft-extension": "extension",
}

export interface DeltaTarget {
  platform: string
  kind: ArtifactKind
  path: string
}

async function publishedIndex(app: string): Promise<AppIndex | undefined> {
  const response = await fetch(downloadUrl(paths.app(app)))
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`Reading ${app}'s index failed with ${response.status}`)
  return appIndex.parse(await response.json())
}

export async function makeDeltas(options: {
  app: string
  version: string
  targets: DeltaTarget[]
  workDirectory: string
  upload: (platform: string, from: string, path: string) => Promise<DeltaReport>
}): Promise<DeltaReport[]> {
  const index = await publishedIndex(options.app)
  if (!index) return []
  const kind = UPDATED_KIND[index.format]
  const previous = index.releases
    .filter((release) => compareVersions(release.version, options.version) < 0)
    .sort((left, right) => compareVersions(right.version, left.version))
    .slice(0, PREVIOUS_RELEASES)
  const reports: DeltaReport[] = []
  for (const target of options.targets.filter((candidate) => candidate.kind === kind)) {
    const size = (await stat(target.path)).size
    for (const release of previous) {
      const old = release.artifacts.find(
        (artifact) => artifact.platform === target.platform && artifact.kind === kind,
      )
      if (!old) continue
      const directory = join(options.workDirectory, "deltas", release.version, target.platform)
      const oldPath = await download(old.url, directory, "previous", old.sha256)
      const patch = join(directory, "patch.zst")
      await runChecked(
        "zstd",
        ["-q", "-19", "--long=31", "-T0", `--patch-from=${oldPath}`, target.path, "-o", patch],
        {
          timeoutSeconds: 1800,
        },
      )
      if ((await stat(patch)).size < size * WORTHWHILE_SHARE)
        reports.push(await options.upload(target.platform, release.version, patch))
    }
  }
  return reports
}
