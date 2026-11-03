import { b, resource } from "@lantharos/pult"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { approve, askForMore, recheck, reject, revoke } from "../../verification/decisions.ts"
import { type PublisherView, publishers } from "../data/records.ts"

async function appIdsOf(publisherId: string) {
  const rows = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(eq(schema.app.publisherId, publisherId))
  return rows.map((row) => row.id)
}

const waiting = (publisher: PublisherView) => publisher.verification === "open"
const reasonInput = z.object({ reason: z.string().trim().min(1).max(2000) })

export const publisher = resource("publisher", {
  icon: "building",
  get: (id) => publishers.byId(id),
  find: (query, limit) => publishers.search(query, limit),
  title: (publisher) => publisher.name,
  subtitle: (publisher) =>
    `${publisher.slug} · ${publisher.kind} · ${publisher.verifiedAt ? "verified" : "not verified"} · ${publisher.status}`,
  fields: (publisher) => ({
    kind: publisher.kind,
    status: publisher.status,
    verified: publisher.verifiedAt ?? "",
  }),
  related: {
    apps: { resource: "app", list: (publisher) => publishers.apps(publisher.id) },
  },
  render: async (publisher) => {
    const [namespaces, apps, trusted, members] = await Promise.all([
      publishers.namespaces(publisher.id),
      publishers.apps(publisher.id),
      publishers.trustedPublishers(publisher.id),
      publishers.members(publisher.id),
    ])
    return [
      b.fields({
        name: publisher.name,
        kind: publisher.kind,
        status: publisher.status,
        verified: publisher.verifiedAt ?? "no",
        website: publisher.website ?? undefined,
        page: `https://schelf.store/publishers/${publisher.slug}`,
        agreement: `${publisher.agreementVersion}, ${publisher.agreementAt.toISOString().slice(0, 10)}`,
      }),
      b.table(
        members.map((member) => ({
          member: member.name,
          email: b.sensitive(member.email),
          role: member.role,
        })),
      ),
      b.table(
        namespaces.map((entry) => ({
          namespace: entry.prefix,
          proof: entry.proof ?? "unproven",
          verified: entry.verifiedAt ?? "",
        })),
      ),
      b.table(apps.map((app) => ({ app: b.ref("app", app.id, app.name), status: app.status }))),
      b.table(
        trusted.map(({ publisher: rule }) => ({
          app: rule.appId,
          repository: rule.repository,
          workflow: rule.workflow,
          environment: rule.environment ?? "",
        })),
      ),
    ]
  },
  actions: (action) => ({
    approveVerification: action({
      label: "Approve",
      description: "Gives the publisher the verified mark on its page, its apps and in the Schelf app.",
      danger: "confirm",
      when: waiting,
      moves: "approved",
      run: ({ record, actor }) => approve(record.id, actor.name),
    }),
    askForMore: action({
      label: "Ask for more",
      description:
        "Sends the publisher a message they answer in the dashboard; their answer comes back here.",
      input: z.object({ message: z.string().trim().min(1).max(5000) }),
      when: waiting,
      moves: "more requested",
      run: ({ record, input, actor }) => askForMore(record.id, actor.name, input.message),
    }),
    rejectVerification: action({
      label: "Reject",
      description: "Declines the request and emails the reason. They can ask again later.",
      input: reasonInput,
      danger: "confirm",
      when: (publisher) => publisher.verification === "open" || publisher.verification === "more-requested",
      moves: "rejected",
      run: ({ record, input, actor }) => reject(record.id, actor.name, input.reason),
    }),
    checkAgain: action({
      label: "Check again",
      description: "Runs the domain, email, GitHub and impersonation checks again and refreshes the item.",
      when: (publisher) => publisher.verification === "open" || publisher.verification === "more-requested",
      run: ({ record }) => recheck(record.id),
    }),
    revokeVerification: action({
      label: "Revoke verification",
      description: "Removes the verified mark and emails the reason.",
      input: reasonInput,
      danger: "reauth",
      when: (publisher) => publisher.verifiedAt !== null,
      run: ({ record, input, actor }) => revoke(record.id, actor.name, input.reason),
    }),
    removePublishers: action({
      label: "Remove trusted publishers",
      description: "Stops every workflow of this publisher from publishing until they add it again.",
      danger: "reauth",
      run: async ({ record }) => {
        const apps = await appIdsOf(record.id)
        if (apps.length)
          await db.delete(schema.trustedPublisher).where(inArray(schema.trustedPublisher.appId, apps))
        return `Removed ${record.name}'s trusted publishers`
      },
    }),
    revokeTokens: action({
      label: "Revoke tokens",
      danger: "reauth",
      run: async ({ record }) => {
        await db
          .update(schema.token)
          .set({ revokedAt: new Date() })
          .where(eq(schema.token.publisherId, record.id))
        return `Revoked ${record.name}'s tokens`
      },
    }),
    suspend: action({
      description: "Stops the publisher from publishing or changing listings. Listed apps stay listed.",
      danger: "reauth",
      run: async ({ record }) => {
        await db
          .update(schema.publisher)
          .set({ status: "suspended" })
          .where(eq(schema.publisher.id, record.id))
        return `Suspended ${record.name}`
      },
    }),
    reinstate: action({
      danger: "confirm",
      run: async ({ record }) => {
        await db.update(schema.publisher).set({ status: "active" }).where(eq(schema.publisher.id, record.id))
        return `${record.name} can publish again`
      },
    }),
    grantNamespace: action({
      label: "Grant namespace",
      description: "Gives the publisher a namespace without a proof, after a claim.",
      input: z.object({
        prefix: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
      }),
      danger: "confirm",
      run: async ({ record, input }) => {
        const now = new Date()
        await db
          .insert(schema.namespace)
          .values({
            prefix: input.prefix,
            publisherId: record.id,
            proof: "manual",
            proofValue: "",
            verifiedAt: now,
            checkedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.namespace.prefix,
            set: { publisherId: record.id, proof: "manual", verifiedAt: now, checkedAt: now },
          })
        return `${input.prefix} belongs to ${record.name}`
      },
    }),
  }),
})
