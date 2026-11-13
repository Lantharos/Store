import {
  type HostedRelease,
  type LinkOptions,
  type ProjectFile,
  partReleases,
  resolveLink,
} from "@schelf/protocol"

export function latestFiles(base: string, releases: HostedRelease[], options: LinkOptions) {
  const targets = new Map(
    releases.flatMap((release) =>
      release.files.map((file) => [
        `${file.part}/${file.platform}`,
        { part: file.part, platform: file.platform },
      ]),
    ),
  )
  const files: ProjectFile[] = []
  for (const { part, platform } of targets.values()) {
    const resolved = resolveLink(partReleases(releases, part), platform, undefined, options)
    if (!resolved || resolved.file.platform !== platform) continue
    for (const file of resolved.release.files.filter((each) => each.platform === platform))
      files.push({
        part,
        version: resolved.release.version,
        name: file.name,
        platform: file.platform,
        kind: file.kind,
        size: file.size,
        sha256: file.sha256,
        url: file.url,
        link: `${base}/latest/${part ? `${part}/` : ""}${platform}/${file.kind}`,
        attestation: file.attestation,
      })
  }
  return files
}
