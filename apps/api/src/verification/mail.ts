import { env, waitUntil } from "cloudflare:workers"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

export type VerificationOutcome = "approved" | "rejected" | "more-requested" | "message" | "revoked"

const SUBJECTS: Record<VerificationOutcome, (name: string) => string> = {
  approved: (name) => `${name} is verified on Schelf`,
  rejected: (name) => `${name} wasn't verified`,
  "more-requested": (name) => `Schelf needs a little more to verify ${name}`,
  message: (name) => `A message about verifying ${name}`,
  revoked: (name) => `${name} is no longer verified on Schelf`,
}

const OPENINGS: Record<VerificationOutcome, string> = {
  approved: "Your publisher page, app pages and the Schelf app now show the verified mark.",
  rejected: "The reviewer decided not to verify it, for this reason:",
  "more-requested": "The reviewer asked for more before deciding:",
  message: "The reviewer wrote:",
  revoked: "The verified mark was removed, for this reason:",
}

async function owners(publisherId: string) {
  const rows = await db
    .select({ email: schema.user.email, name: schema.publisher.name })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
    .where(and(eq(schema.member.publisherId, publisherId), eq(schema.member.role, "owner")))
  return rows
}

export function notifyVerification(publisherId: string, outcome: VerificationOutcome, message?: string) {
  waitUntil(
    owners(publisherId).then((rows) =>
      Promise.all(
        rows.map((row) =>
          env.EMAIL.send({
            from: env.NOTIFY_FROM,
            to: row.email,
            subject: SUBJECTS[outcome](row.name),
            text: [
              OPENINGS[outcome],
              message,
              outcome === "approved" || outcome === "revoked"
                ? null
                : `Answer in the dashboard, not by email:\n${env.PUBLIC_URL}/dashboard/verification?publisher=${publisherId}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          }),
        ),
      ),
    ),
  )
}
