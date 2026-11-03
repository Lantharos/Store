import { z } from "zod"
import { utf8 } from "../encoding.ts"
import { SABINE_ARTIFACT_KINDS } from "../platforms.ts"
import { type SigningKey, verifySignature } from "../signing.ts"

export const sabineVersion = z.object({ major: z.number().int(), build: z.number().int() })
export type SabineVersion = z.infer<typeof sabineVersion>

export const sabineArtifact = z.object({
  url: z.string(),
  sha256: z.string(),
  kind: z.enum(SABINE_ARTIFACT_KINDS).default("archive"),
  executable: z.string().nullable().default(null),
})
export type SabineArtifact = z.infer<typeof sabineArtifact>

export const SABINE_RELEASE_SCHEMA = 1

export const sabineFeed = z.object({
  schema: z.number().int().default(SABINE_RELEASE_SCHEMA),
  app_id: z.string(),
  version: z.string(),
  channel: z.string().default("stable"),
  published_at: z.string(),
  requires_sabine: sabineVersion.default({ major: 0, build: 0 }),
  artifacts: z.record(z.string(), sabineArtifact),
  signature: z.string().default(""),
})
export type SabineFeed = z.infer<typeof sabineFeed>

export function parseSabineVersion(value: string): SabineVersion {
  const [major = 0, build = 0] = value.replace(/^v/, "").split(".").map(Number)
  return { major, build }
}

export function sabineTarget(platform: string, kind: SabineArtifact["kind"], packaged: boolean) {
  return packaged ? `${platform}-${kind === "app-image" ? "appimage" : kind}` : platform
}

export function sabineSigningPayload(feed: SabineFeed) {
  const artifacts: Record<string, SabineArtifact> = {}
  for (const target of Object.keys(feed.artifacts).sort(compareBytes)) {
    const artifact = feed.artifacts[target]!
    artifacts[target] = {
      url: artifact.url,
      sha256: artifact.sha256,
      kind: artifact.kind,
      executable: artifact.executable,
    }
  }
  return JSON.stringify({
    schema: feed.schema,
    app_id: feed.app_id,
    version: feed.version,
    channel: feed.channel,
    published_at: feed.published_at,
    requires_sabine: { major: feed.requires_sabine.major, build: feed.requires_sabine.build },
    artifacts,
    signature: "",
  })
}

export async function signSabineFeed(key: SigningKey, feed: SabineFeed): Promise<SabineFeed> {
  const unsigned = { ...feed, signature: "" }
  const payload = sabineSigningPayload(unsigned)
  return { ...(JSON.parse(payload) as SabineFeed), signature: await key.sign(utf8(payload)) }
}

export function verifySabineFeed(publicKey: string, feed: SabineFeed) {
  return verifySignature(publicKey, utf8(sabineSigningPayload(feed)), feed.signature)
}

function compareBytes(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}
