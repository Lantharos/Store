import { env } from "cloudflare:workers"
import { b } from "@lantharos/pult"
import { CHECK_TITLES, paths } from "@schelf/protocol"
import type { schema } from "../../db/client.ts"
import type { ReleaseView } from "../data/releases.ts"

const DIGEST_BUDGET = 24_000
const DETAIL_BUDGET = 8_000

interface Facts {
  malware?: unknown
  diff?: unknown
  patch?: string
  compare?: string
  licence?: unknown
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, DETAIL_BUDGET)
}

export async function factBlocks(release: ReleaseView) {
  const object = await env.BUCKET.get(paths.check(release.appId, release.version, "facts"))
  if (!object) return []
  const facts = await object.json<Facts>()
  return [
    ...(facts.compare ? [b.fields({ "source changes": b.link(facts.compare, "Compare on GitHub") })] : []),
    ...(facts.malware ? [b.code(json(facts.malware), { lang: "json", title: "Malware scan" })] : []),
    ...(facts.licence ? [b.code(json(facts.licence), { lang: "json", title: "Licence" })] : []),
    ...(facts.diff ? [b.code(json(facts.diff), { lang: "json", title: "What changed" })] : []),
    ...(facts.patch
      ? [b.code(facts.patch.slice(0, DIGEST_BUDGET), { lang: "diff", title: "Riskiest changes" })]
      : []),
  ]
}

export async function checkDetailBlocks(checks: (typeof schema.check.$inferSelect)[]) {
  const flagged = checks.filter((check) => check.status !== "passed" && check.detailKey)
  const details = await Promise.all(
    flagged.map(async (check) => {
      const object = await env.BUCKET.get(check.detailKey!)
      return object
        ? b.code(json(await object.json()), { lang: "json", title: `${CHECK_TITLES[check.name]}, in detail` })
        : null
    }),
  )
  return details.filter((block) => block !== null)
}
