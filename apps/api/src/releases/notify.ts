import { env, waitUntil } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

type Outcome = "failed" | "approved" | "changes-requested" | "rejected" | "pulled"

const SUBJECTS: Record<Outcome, (app: string, version: string) => string> = {
  failed: (app, version) => `${app} ${version} didn't pass the checks`,
  approved: (app, version) => `${app} ${version} is approved and rolling out`,
  "changes-requested": (app, version) => `${app} ${version} needs a few changes`,
  rejected: (app, version) => `${app} ${version} wasn't approved`,
  pulled: (app, version) => `${app} ${version} was pulled from schelf.store`,
}

const OPENINGS: Record<Outcome, string> = {
  failed:
    "One of the checks failed, so the release didn't go to review. The details are on the release page.",
  approved:
    "It starts with 10% of devices and reaches everyone over the next three days unless you change it.",
  "changes-requested": "The reviewer asked for changes before approving it:",
  rejected: "The reviewer decided not to approve it, for this reason:",
  pulled: "It was blocked from installing and starting, for this reason:",
}

function recipients(releaseId: string) {
  return db
    .select({
      email: schema.user.email,
      app: schema.release.appId,
      version: schema.release.version,
    })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.member, eq(schema.member.publisherId, schema.app.publisherId))
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.release.id, releaseId))
}

export function notifyPublisher(releaseId: string, outcome: Outcome, message?: string) {
  waitUntil(
    recipients(releaseId).then((rows) =>
      Promise.all(
        rows.map((row) => {
          const page = `${env.PUBLIC_URL}/dashboard/apps/${row.app}/releases/${releaseId}`
          return env.EMAIL.send({
            from: env.NOTIFY_FROM,
            to: row.email,
            subject: SUBJECTS[outcome](row.app, row.version),
            text: [OPENINGS[outcome], message, `\n${page}`].filter(Boolean).join("\n\n"),
          })
        }),
      ),
    ),
  )
}
