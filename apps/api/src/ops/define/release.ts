import { b, resource } from "@lantharos/pult"
import { z } from "zod"
import { pull, unpull } from "../../releases/moderation.ts"
import { approve, reject, requestChanges } from "../../releases/review.ts"
import { controlRollout } from "../../releases/rollout.ts"
import { factBlocks } from "../data/facts.ts"
import { listingBlocks } from "../data/listing.ts"
import { type ReleaseView, releases } from "../data/records.ts"

const CHECK_MARKS = { passed: "passed", warning: "warning", failed: "failed" } as const

export async function releaseBlocks(release: ReleaseView) {
  const [checks, artifacts] = await Promise.all([releases.checks(release.id), releases.artifacts(release.id)])
  return [
    b.fields({
      app: b.ref("app", release.appId, release.name),
      developer: b.ref("developer", release.developerId, release.developer),
      version: release.version,
      status: release.status,
      built: release.origin === "oidc" ? "on GitHub Actions" : "uploaded by the developer",
      run: release.runUrl ?? undefined,
      commit:
        release.commit && release.repository
          ? `https://github.com/${release.repository}/commit/${release.commit}`
          : undefined,
      tag: release.tag ?? undefined,
      "wider permissions": release.permissionsWidened ? "yes" : undefined,
      rollout: release.approvedAt
        ? `${release.rolloutPercent}%${release.rolloutPaused ? ", paused" : ""}`
        : undefined,
    }),
    b.table(
      checks.map((check) => ({
        check: check.name,
        result: CHECK_MARKS[check.status],
        summary: check.summary,
      })),
    ),
    b.table(
      artifacts.map((artifact) => ({
        file: artifact.name,
        system: artifact.platform,
        size: `${(artifact.size / 1_000_000).toFixed(1)} MB`,
        attested: artifact.attestationUrl ? "yes" : "no",
      })),
    ),
    ...(release.permissions
      ? [b.code(JSON.stringify(release.permissions, null, 2), { lang: "json", title: "Permissions" })]
      : []),
    ...(release.notes ? [b.markdown(release.notes)] : []),
    ...(await factBlocks(release)),
    ...(await listingBlocks(release.appId)),
  ]
}

const reasonInput = z.object({ reason: z.string().trim().min(1).max(2000) })
const waiting = (release: ReleaseView) => release.status === "in-review"
const shipped = (release: ReleaseView) => release.status === "rolling-out" || release.status === "live"

export const release = resource("release", {
  icon: "package",
  get: (id) => releases.byId(id),
  find: (query, limit) => releases.search(query, limit),
  title: (release) => `${release.name} ${release.version}`,
  subtitle: (release) => `${release.appId} · ${release.status}`,
  fields: (release) => ({
    status: release.status,
    rollout: release.rolloutPercent,
    created: release.createdAt,
  }),
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
      label: "Request changes",
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
      danger: "confirm",
      when: (release) => release.status === "rolling-out" && !release.rolloutPaused,
      run: ({ record }) => controlRollout(record, { action: "pause" }),
    }),
    resume: action({
      label: "Resume rollout",
      danger: "confirm",
      when: (release) => release.status === "rolling-out" && release.rolloutPaused,
      run: ({ record }) => controlRollout(record, { action: "resume" }),
    }),
    rollback: action({
      label: "Roll back",
      description: "Withdraws the release; devices are offered the previous version.",
      danger: "confirm",
      when: shipped,
      run: ({ record }) => controlRollout(record, { action: "rollback" }),
    }),
    pull: action({
      description: "Blocks this version from installing and starting on every device, with a public note.",
      input: z.object({ reason: z.string().trim().min(1).max(200), note: z.string().trim().min(1).max(500) }),
      danger: "reauth",
      when: (release) => release.status !== "pulled",
      run: async ({ record, input }) => {
        await pull({ app: record.appId, release: record.id }, input.reason, input.note)
        return `Pulled ${record.appId} ${record.version}`
      },
    }),
    unpull: action({
      danger: "reauth",
      when: (release) => release.status === "pulled",
      run: async ({ record }) => {
        await unpull({ app: record.appId, release: record.id })
        return `${record.appId} ${record.version} can start again`
      },
    }),
    askClaude: action({
      label: "Ask Claude to review",
      run: ({ record }) => ({
        message: "Run this in the Store repository",
        blocks: [b.code(`bun run review ${record.appId}@${record.version}`, { lang: "sh" })],
      }),
    }),
  }),
})
