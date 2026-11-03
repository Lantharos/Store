import { glob, stat } from "node:fs/promises"
import type { Format } from "@schelf/protocol"
import { ArtifactError, type InferredArtifact, ignoredFile, inferArtifact } from "./artifacts.ts"

export async function expandFiles(patterns: string[]) {
  const paths = new Set<string>()
  for (const pattern of patterns) {
    for await (const path of glob(pattern)) {
      if ((await stat(path)).isFile() && !ignoredFile(path)) paths.add(path)
    }
  }
  return [...paths].sort()
}

export async function collectArtifacts(patterns: string[], format: Format): Promise<InferredArtifact[]> {
  const paths = await expandFiles(patterns)
  if (!paths.length) throw new ArtifactError(`No files match ${patterns.join(", ")}`)
  const artifacts = await Promise.all(paths.map((path) => inferArtifact(path, format)))
  const seen = new Map<string, string>()
  for (const artifact of artifacts) {
    const previous = seen.get(artifact.name)
    if (previous)
      throw new ArtifactError(`Two files are named ${artifact.name}: ${previous} and ${artifact.path}`)
    seen.set(artifact.name, artifact.path)
  }
  return artifacts
}
