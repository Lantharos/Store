import { b, home, page } from "@lantharos/pult"
import { activeBlocks, rollingOut, storeTotals, suspendedPublishers } from "../data/store.ts"
import { rolloutsFrozen, submissionsOpen } from "./flags.ts"
import { reports, submissions, updates } from "./inboxes.ts"
import { mail } from "./mail.ts"
import { prepareKey, publishKeys, resign } from "./store.ts"
import { verification } from "./verification.ts"
import { routineUpdates } from "./views.ts"

export default home([
  b.columns(
    [b.count(submissions, { filter: { state: "open" }, label: "New apps" })],
    [b.count(updates, { filter: { state: "open" }, label: "Updates" })],
    [b.count(routineUpdates)],
    [b.count(reports, { filter: { state: "open" }, label: "Reports" })],
    [b.count(verification, { filter: { state: "open" }, label: "Verification" })],
    [b.count(mail, { filter: { state: "open" }, label: "Mail" })],
  ),
  b.columns(
    [b.items(submissions, { filter: { state: "open" }, limit: 5 })],
    [b.items(updates, { filter: { state: "open" }, limit: 5 })],
  ),
  b.columns(
    [b.items(reports, { filter: { state: "open" }, limit: 5 })],
    [b.items(verification, { filter: { state: "open" }, limit: 5 })],
    [b.items(mail, { filter: { state: "open" }, limit: 5 })],
  ),
  b.columns([b.flag(submissionsOpen)], [b.flag(rolloutsFrozen)]),
])

export const store = page("store", {
  icon: "gauge",
  render: async () => {
    const [totals, rolling, blocks, suspended] = await Promise.all([
      storeTotals(),
      rollingOut(),
      activeBlocks(),
      suspendedPublishers(),
    ])
    return [
      b.stats({
        "Listed apps": totals.listed,
        Publishers: { value: totals.publishers, note: `${totals.verified} verified` },
        "Installs, 30 days": totals.installs,
        "Rolling out": rolling.length,
      }),
      b.table(
        rolling.map((release) => ({
          release: b.ref("release", release.id, `${release.name ?? release.appId} ${release.version}`),
          share: `${release.percent}%`,
          paused: release.paused,
          "last step": release.steppedAt ?? undefined,
        })),
        { title: "Rolling out" },
      ),
      b.table(
        blocks.map((block) => ({
          app: b.ref("app", block.appId, block.appId),
          version: block.releaseId
            ? b.ref("release", block.releaseId, block.version ?? undefined)
            : "Every version",
          reason: block.reason,
          since: block.createdAt,
        })),
        { title: "Pulled" },
      ),
      b.table(
        suspended.map((publisher) => ({ publisher: b.ref("publisher", publisher.id, publisher.name) })),
        { title: "Suspended publishers" },
      ),
      b.actions(resign, prepareKey, publishKeys),
    ]
  },
})
