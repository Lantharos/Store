import { glob, readFile, stat } from "node:fs/promises"
import { basename } from "node:path"
import { type Format, type Platform, UPDATER_SIGNATURE } from "@schelf/protocol"
import {
  ArtifactError,
  type InferredArtifact,
  ignoredFile,
  inferArtifact,
  splitPlatform,
} from "./artifacts.ts"

export async function expandFiles(patterns: string[]) {
  const paths = new Map<string, Platform | undefined>()
  for (const entry of patterns) {
    const { pattern, platform } = splitPlatform(entry)
    for await (const path of glob(pattern)) {
      if ((await stat(path)).isFile() && !ignoredFile(path)) paths.set(path, platform)
    }
  }
  return [...paths].sort(([left], [right]) => left.localeCompare(right))
}

export async function collectArtifacts(patterns: string[], format: Format): Promise<InferredArtifact[]> {
  const found = await expandFiles(patterns)
  if (!found.length) throw new ArtifactError(`No files match ${patterns.join(", ")}`)
  const signatures = new Map<string, string>()
  const files = found.filter(([path]) => !UPDATER_SIGNATURE.test(path))
  for (const [path] of found.filter(([path]) => UPDATER_SIGNATURE.test(path)))
    signatures.set(basename(path).replace(UPDATER_SIGNATURE, ""), (await readFile(path, "utf8")).trim())
  const artifacts = await Promise.all(
    files.map(async ([path, platform]) => {
      const artifact = await inferArtifact(path, format)
      return {
        ...artifact,
        ...(platform && { platform }),
        ...(signatures.has(artifact.name) && { signature: signatures.get(artifact.name) }),
      }
    }),
  )
  const seen = new Map<string, string>()
  for (const artifact of artifacts) {
    const previous = seen.get(artifact.name)
    if (previous)
      throw new ArtifactError(`Two files are named ${artifact.name}: ${previous} and ${artifact.path}`)
    seen.set(artifact.name, artifact.path)
  }
  return artifacts
}
