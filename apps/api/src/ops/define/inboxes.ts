import { b, inbox } from "@lantharos/pult"
import { z } from "zod"
import { releases } from "../data/records.ts"
import { app } from "./app.ts"
import { developer } from "./developer.ts"
import { release, releaseBlocks } from "./release.ts"

const REVIEW_STATES = ["open", "changes requested", "approved", "rejected"]
const releaseData = z.object({
  app: z.string(),
  name: z.string(),
  version: z.string(),
  developer: z.string(),
})

async function renderRelease(id: string | null) {
  const current = id ? await releases.byId(id) : null
  return current ? releaseBlocks(current) : [b.markdown("This release no longer exists.")]
}

export const submissions = inbox("submissions", {
  icon: "inbox",
  resource: release,
  states: REVIEW_STATES,
  closed: ["approved", "rejected"],
  sla: { open: "2d" },
  data: releaseData,
  title: (data) => `${data.name} ${data.version} from ${data.developer}`,
  render: (item) => renderRelease(item.record),
})

export const updates = inbox("updates", {
  icon: "refresh",
  resource: release,
  states: REVIEW_STATES,
  closed: ["approved", "rejected"],
  sla: { open: "1d" },
  data: releaseData,
  title: (data) => `${data.name} ${data.version}`,
  render: (item) => renderRelease(item.record),
})

export const reports = inbox("reports", {
  icon: "flag",
  resource: app,
  states: ["open", "actioned", "dismissed"],
  closed: ["actioned", "dismissed"],
  sla: { open: "1d" },
  data: z.object({
    app: z.string(),
    kind: z.string(),
    reason: z.string(),
    explanation: z.string(),
    location: z.string().nullable(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  title: (data) => `${data.kind.toUpperCase()} report on ${data.app}: ${data.reason}`,
  render: (item) => [
    b.fields({
      app: b.ref("app", item.data.app, item.data.app),
      kind: item.data.kind,
      where: item.data.location ?? undefined,
      from: item.data.name ?? undefined,
      email: item.data.email ? b.sensitive(item.data.email) : undefined,
    }),
    b.markdown(item.data.explanation),
  ],
})

export const claims = inbox("claims", {
  icon: "scale",
  resource: developer,
  states: ["open", "granted", "declined"],
  closed: ["granted", "declined"],
  data: z.object({ claimant: z.string(), subject: z.string(), evidence: z.string() }),
  title: (data) => `${data.claimant} claims ${data.subject}`,
  render: (item) => [
    b.fields({ claimant: item.data.claimant, subject: item.data.subject }),
    b.markdown(item.data.evidence),
  ],
})
