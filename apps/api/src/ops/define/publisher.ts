import { resource } from "@lantharos/pult"
import { PUBLISHER_KINDS } from "@schelf/protocol"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { approve, askForMore, recheck, reject, revoke } from "../../verification/decisions.ts"
import { apps } from "../data/apps.ts"
import { PUBLISHER_KIND, PUBLISHER_STATUS } from "../data/labels.ts"
import { publisherPage } from "../data/links.ts"
import { type PublisherView, publishers } from "../data/publishers.ts"
import { publisherBlocks } from "../render/publisher.ts"

const waiting = (publisher: PublisherView) => publisher.verification === "open"
const undecided = (publisher: PublisherView) =>
  publisher.verification === "open" || publisher.verification === "more-requested"
const reasonInput = z.object({ reason: z.string().trim().min(1).max(2000).describe("Emailed to the owners") })

async function setStatus(publisher: PublisherView, status: PublisherView["status"]) {
  await db.update(schema.publisher).set({ status }).where(eq(schema.publisher.id, publisher.id))
}

export const publisher = resource("publisher", {
  icon: "building",
  get: (id) => publishers.byId(id),
  find: (query, limit) => publishers.search(query, limit),
  list: {
    filters: z.object({
      status: z.enum(["active", "suspended"]).optional(),
      kind: z.enum(PUBLISHER_KINDS).optional(),
      verified: z.boolean().optional(),
    }),
    run: ({ query, filters, cursor, limit }) => publishers.browse(query, filters, cursor, limit),
  },
  title: (publisher) => publisher.name,
  subtitle: (publisher) =>
    [
      publisher.slug,
      PUBLISHER_KIND[publisher.kind],
      publisher.verifiedAt ? "Verified" : undefined,
      publisher.status === "suspended" ? "Suspended" : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
  fields: (publisher) => ({
    kind: PUBLISHER_KIND[publisher.kind],
    status: PUBLISHER_STATUS[publisher.status],
    verified: publisher.verifiedAt !== null,
    apps: publisher.apps,
  }),
  url: (publisher) => publisherPage(publisher),
  related: {
    apps: { resource: "app", list: (publisher) => apps.ofPublisher(publisher.id) },
  },
  render: (publisher) => publisherBlocks(publisher),
  actions: (action) => ({
    approveVerification: action({
      label: "Verify",
      description: "Gives the publisher the verified mark on its page, its apps and in the Schelf app.",
      danger: "confirm",
      when: waiting,
      moves: "approved",
      run: ({ record, actor }) => approve(record.id, actor.name),
    }),
    askForMore: action({
      label: "Ask for more",
      description: "Sends the owners a message they answer in the dashboard; their answer comes back here.",
      input: z.object({ message: z.string().trim().min(1).max(5000) }),
      when: waiting,
      moves: "more requested",
      run: ({ record, input, actor }) => askForMore(record.id, actor.name, input.message),
    }),
    rejectVerification: action({
      label: "Decline verification",
      description: "Declines the request and emails the reason. They can ask again later.",
      input: reasonInput,
      danger: "confirm",
      when: undecided,
      moves: "rejected",
      run: ({ record, input, actor }) => reject(record.id, actor.name, input.reason),
    }),
    checkAgain: action({
      label: "Check again",
      description: "Runs the domain, email, GitHub and impersonation checks again and refreshes the request.",
      when: undecided,
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
    suspend: action({
      description: "Stops the publisher from publishing or changing listings. Listed apps stay listed.",
      danger: "reauth",
      when: (publisher) => publisher.status === "active",
      run: async ({ record }) => {
        await setStatus(record, "suspended")
        return `Suspended ${record.name}`
      },
    }),
    reinstate: action({
      description: "Lets the publisher publish and change listings again.",
      danger: "confirm",
      when: (publisher) => publisher.status === "suspended",
      run: async ({ record }) => {
        await setStatus(record, "active")
        return `${record.name} can publish again`
      },
    }),
    removePublishers: action({
      label: "Remove all trusted publishers",
      description: "Stops every workflow of this publisher from publishing until they add them again.",
      danger: "reauth",
      when: (publisher) => publisher.trustedPublishers > 0,
      run: async ({ record }) => {
        const owned = (await apps.ofPublisher(record.id)).map((app) => app.id)
        await db.delete(schema.trustedPublisher).where(inArray(schema.trustedPublisher.appId, owned))
        return `Removed ${record.name}'s trusted publishers`
      },
    }),
    revokeTokens: action({
      label: "Revoke all tokens",
      description: "Stops every upload token of this publisher. They can make new ones.",
      danger: "reauth",
      when: (publisher) => publisher.activeTokens > 0,
      run: async ({ record }) => {
        await db
          .update(schema.token)
          .set({ revokedAt: new Date() })
          .where(and(eq(schema.token.publisherId, record.id), isNull(schema.token.revokedAt)))
        return `Revoked ${record.name}'s tokens`
      },
    }),
    grantNamespace: action({
      label: "Grant a namespace",
      description:
        "Gives the publisher a namespace without a proof, taking it from whoever holds it, after a dispute.",
      input: z.object({
        prefix: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
          .describe("Like org.example"),
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
