import type { ReleaseSummary } from "@schelf/protocol"

export function linkedRelease(releases: ReleaseSummary[], channel: string, followsRollout: boolean) {
  return releases.find(
    (release) =>
      release.channel === channel &&
      !release.bridge &&
      (release.status === "live" || (followsRollout && release.status === "rolling-out")),
  )
}

export function channelLink(latest: string, channel: string) {
  return channel === "stable" ? latest : latest.replace(/\/latest$/, `/@${channel}/latest`)
}
