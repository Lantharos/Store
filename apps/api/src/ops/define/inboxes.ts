import { b, choice, inbox, noul, run, score, tag, triage } from "@lantharos/pult"
import { z } from "zod"
import { releases } from "../data/records.ts"
import { app } from "./app.ts"
import { developer } from "./developer.ts"
import { release, releaseBlocks } from "./release.ts"

const REVIEW_STATES = ["open", "changes requested", "approved", "rejected"]

const INSTRUCTIONS =
  "Each item is a release of a desktop app submitted to schelf.store, an app store for Linux, Windows and macOS. " +
  "It shows the store's checks, the files, the declared permissions, the listing and, for updates, a digest of the source changes. " +
  "Judge the submission itself; a person makes every decision that isn't obvious junk."

const JUNK_REASON =
  "This submission is empty, broken, a placeholder or spam, so it wasn't reviewed further. " +
  "This was decided automatically; reply to this email if you think it's wrong and a person will look again."

const INCOMPLETE_MESSAGE =
  "The listing needs more before it can be reviewed: a clear name and summary, a description, an icon, " +
  "at least two screenshots per system and a category. The release page shows what's missing."

const firstLook = {
  junk: noul("Is this an empty, broken, placeholder or spam submission?"),
  kind: choice(
    {
      genuine: "A real app doing what its listing says",
      copycat: "A copy of another app, or passing itself off as one",
      malware: "Looks built to harm or deceive the people who install it",
      incomplete: "A real app whose listing isn't finished",
    },
    "What is this submission?",
  ),
  quality: score(
    ["low", "fair", "good"],
    "How finished does the listing look: name, summary, description, icon, screenshots?",
  ),
}

const firstLookRules = [
  {
    name: "Close junk",
    when: (a: { junk: number; confidence: number }) => a.junk > 0.95 && a.confidence > 0.9,
    then: run(release.actions.reject, { reason: JUNK_REASON }),
  },
  {
    name: "Flag malware suspects",
    when: (a: { kind: string }) => a.kind === "malware",
    then: tag("malware"),
  },
  { name: "Flag copycats", when: (a: { kind: string }) => a.kind === "copycat", then: tag("impersonation") },
  {
    name: "Ask for a finished listing",
    when: (a: { quality: number }) => a.quality < 0.7,
    then: run(release.actions.requestChanges, { message: INCOMPLETE_MESSAGE }),
  },
]
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
  triage: triage({ instructions: INSTRUCTIONS, questions: firstLook, rules: firstLookRules }),
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
  triage: triage({
    instructions: INSTRUCTIONS,
    questions: {
      ...firstLook,
      risky: noul(
        "Does the update add network endpoints, obfuscated or binary blobs, new install or build scripts, or code unrelated to the app's purpose?",
      ),
      scope: choice(
        {
          routine: "Fixes and small changes",
          feature: "New features",
          rewrite: "Large parts rewritten or replaced",
        },
        "How big is this update?",
      ),
    },
    rules: [
      ...firstLookRules,
      {
        name: "Fast lane for routine updates",
        when: (a) => a.scope === "routine" && a.risky < 0.05,
        then: tag("routine"),
      },
    ],
  }),
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
