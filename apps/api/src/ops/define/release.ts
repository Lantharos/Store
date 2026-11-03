import { b, resource } from "@lantharos/pult"
import { RELEASE_STATUSES } from "@schelf/protocol"
import { z } from "zod"
import { pull, unpull } from "../../releases/moderation.ts"
import { approve, reject, requestChanges } from "../../releases/review.ts"
import { controlRollout } from "../../releases/rollout.ts"
import { RELEASE_STATUS } from "../data/labels.ts"
import { appPage } from "../data/links.ts"
import { type ReleaseView, releases } from "../data/releases.ts"
import { releaseBlocks, releaseState } from "../render/release.ts"

const reasonInput = z.object({ reason: z.string().trim().min(1).max(2000) })
const pullInput = z.object({
  reason: z.string().trim().min(1).max(200).describe("For the record; the developer sees it too"),
  note: z.string().trim().min(1).max(500).describe("Shown to everyone who installed it"),
})

const waiting = (release: ReleaseView) => release.status === "in-review"
const rolling = (release: ReleaseView) => release.status === "rolling-out"
const shipped = (release: ReleaseView) => release.status === "rolling-out" || release.status === "live"
const pullable = (release: ReleaseView) => shipped(release) || release.status === "withdrawn"

export const release = resource("release", {
  icon: "package",
  get: (id) => releases.byId(id),
  find: (query, limit) => releases.search(query, limit),
  list: {
    filters: z.object({ status: z.enum(RELEASE_STATUSES).optional() }),
    run: ({ query, filters, cursor, limit }) => releases.browse(query, filters.status, cursor, limit),
  },
  title: (release) => `${release.name} ${release.version}`,
  subtitle: (release) => `${release.appId} · ${release.channel} · ${releaseState(release)}`,
  fields: (release) => ({
    status: RELEASE_STATUS[release.status],
    channel: release.channel,
    rollout: shipped(release) ? `${release.rolloutPercent}%${release.rolloutPaused ? ", paused" : ""}` : "",
    published: release.createdAt,
  }),
  url: (release) =>
    appPage({ ...release, id: release.appId, status: release.appStatus }, release.publisherSlug),
  render: (release) => releaseBlocks(release),
  actions: (action) => ({
    approve: action({
      description: "Signs the release into the index and the update feeds and starts the rollout at 10%.",
      danger: "confirm",
      when: waiting,
      moves: "approved",
      run: ({ record, actor }) => approve(record.id, actor.name),
    }),
    approveSecurityFix: action({
      label: "Approve as a security fix",
      description: "Approves the release and sends it to everyone at once.",
      danger: "confirm",
      when: waiting,
      moves: "approved",
      run: ({ record, actor }) => approve(record.id, actor.name, { security: true }),
    }),
    requestChanges: action({
      label: "Ask for changes",
      description: "Sends the developer a message; they fix it and publish again.",
      input: z.object({ message: z.string().trim().min(1).max(5000) }),
      when: waiting,
      moves: "changes requested",
      automatable: true,
      run: ({ record, input, actor }) => requestChanges(record.id, actor.name, input.message),
    }),
    reject: action({
      description: "Rejects the release and sends the developer the reason as a statement of reasons.",
      input: reasonInput,
      danger: "confirm",
      when: waiting,
      moves: "rejected",
      automatable: true,
      run: ({ record, input, actor }) => reject(record.id, actor.name, input.reason),
    }),
    pause: action({
      label: "Pause rollout",
      description: "Keeps the rollout where it is until it's resumed.",
      danger: "confirm",
      when: (release) => rolling(release) && !release.rolloutPaused,
      run: ({ record }) => controlRollout(record, { action: "pause" }),
    }),
    resume: action({
      label: "Resume rollout",
      when: (release) => rolling(release) && release.rolloutPaused,
      run: ({ record }) => controlRollout(record, { action: "resume" }),
    }),
    sendToEveryone: action({
      label: "Send to everyone",
      description: "Skips the remaining rollout steps.",
      danger: "confirm",
      when: rolling,
      run: ({ record }) => controlRollout(record, { action: "all" }),
    }),
    setRollout: action({
      label: "Set rollout",
      description: "Offers the release to this share of devices.",
      input: z.object({ percent: z.number().int().min(1).max(100) }),
      defaults: (release) => ({ percent: release.rolloutPercent }),
      danger: "confirm",
      when: shipped,
      run: ({ record, input }) => controlRollout(record, { action: "set", percent: input.percent }),
    }),
    rollback: action({
      label: "Roll back",
      description: "Withdraws the release; devices are offered the version before it.",
      danger: "confirm",
      when: shipped,
      run: ({ record }) => controlRollout(record, { action: "rollback" }),
    }),
    pull: action({
      description:
        "Stops this version from installing and starting on every device and shows the note to people who have it.",
      input: pullInput,
      danger: "reauth",
      when: pullable,
      run: async ({ record, input }) => {
        await pull({ app: record.appId, release: record.id }, input.reason, input.note)
        return `Pulled ${record.name} ${record.version}`
      },
    }),
    unpull: action({
      label: "Undo pull",
      description: "Lets this version install and start again.",
      danger: "reauth",
      when: (release) => release.status === "pulled",
      run: async ({ record }) => {
        await unpull({ app: record.appId, release: record.id })
        return `${record.name} ${record.version} can start again`
      },
    }),
    askClaude: action({
      label: "Review with Claude",
      description: "Shows the command that installs and tries the app in a throwaway VM.",
      run: ({ record }) => ({
        message: "Run this in the store's repository",
        blocks: [b.code(`bun run review ${record.appId}@${record.version}`, { lang: "sh" })],
      }),
    }),
  }),
})
