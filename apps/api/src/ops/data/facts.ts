import { env } from "cloudflare:workers"
import { b } from "@lantharos/pult"
import { paths } from "@schelf/protocol"
import type { ReleaseView } from "./records.ts"

const DIGEST_BUDGET = 24_000

interface Facts {
  malware?: unknown
  diff?: unknown
  patch?: string
  compare?: string
  licence?: unknown
}

export async function factBlocks(release: ReleaseView) {
  const object = await env.BUCKET.get(paths.check(release.appId, release.version, "facts"))
  if (!object) return []
  const facts = await object.json<Facts>()
  return [
    ...(facts.compare ? [b.fields({ "source changes": facts.compare })] : []),
    ...(facts.malware
      ? [b.code(JSON.stringify(facts.malware, null, 2), { lang: "json", title: "Malware scan" })]
      : []),
    ...(facts.licence
      ? [b.code(JSON.stringify(facts.licence, null, 2), { lang: "json", title: "Licence" })]
      : []),
    ...(facts.diff
      ? [b.code(JSON.stringify(facts.diff, null, 2), { lang: "json", title: "What changed" })]
      : []),
    ...(facts.patch
      ? [b.code(facts.patch.slice(0, DIGEST_BUDGET), { lang: "diff", title: "Riskiest changes" })]
      : []),
  ]
}
