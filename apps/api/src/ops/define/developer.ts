import { b, resource } from "@lantharos/pult"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { developers } from "../data/records.ts"

async function appIdsOf(developerId: string) {
  const rows = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(eq(schema.app.developerId, developerId))
  return rows.map((row) => row.id)
}

export const developer = resource("developer", {
  icon: "user",
  get: (id) => developers.byId(id),
  find: (query, limit) => developers.search(query, limit),
  title: (developer) => developer.name,
  subtitle: (developer) => `${developer.slug} · ${developer.status}`,
  fields: (developer) => ({
    kind: developer.kind,
    status: developer.status,
    github: developer.githubLogin ?? "",
  }),
  related: {
    apps: { resource: "app", list: (developer) => developers.apps(developer.id) },
  },
  render: async (developer) => {
    const [namespaces, apps, publishers] = await Promise.all([
      developers.namespaces(developer.id),
      developers.apps(developer.id),
      developers.publishers(developer.id),
    ])
    return [
      b.fields({
        name: developer.name,
        kind: developer.kind,
        status: developer.status,
        github: developer.githubLogin ?? undefined,
        agreement: `${developer.agreementVersion}, ${developer.agreementAt.toISOString().slice(0, 10)}`,
      }),
      b.table(
        namespaces.map((entry) => ({
          namespace: entry.prefix,
          proof: entry.proof ?? "unproven",
          verified: entry.verifiedAt ?? "",
        })),
      ),
      b.table(apps.map((app) => ({ app: b.ref("app", app.id, app.name), status: app.status }))),
      b.table(
        publishers.map(({ publisher }) => ({
          app: publisher.appId,
          repository: publisher.repository,
          workflow: publisher.workflow,
          environment: publisher.environment ?? "",
        })),
      ),
    ]
  },
  actions: (action) => ({
    removePublishers: action({
      label: "Remove trusted publishers",
      description: "Stops every workflow of this developer from publishing until they add it again.",
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
          .where(eq(schema.token.developerId, record.id))
        return `Revoked ${record.name}'s tokens`
      },
    }),
    suspend: action({
      description: "Stops the developer from publishing or changing listings. Listed apps stay listed.",
      danger: "reauth",
      run: async ({ record }) => {
        await db
          .update(schema.developer)
          .set({ status: "suspended" })
          .where(eq(schema.developer.id, record.id))
        return `Suspended ${record.name}`
      },
    }),
    reinstate: action({
      danger: "confirm",
      run: async ({ record }) => {
        await db.update(schema.developer).set({ status: "active" }).where(eq(schema.developer.id, record.id))
        return `${record.name} can publish again`
      },
    }),
    grantNamespace: action({
      label: "Grant namespace",
      description: "Gives the developer a namespace without a proof, after a claim.",
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
            developerId: record.id,
            proof: "manual",
            proofValue: "",
            verifiedAt: now,
            checkedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.namespace.prefix,
            set: { developerId: record.id, proof: "manual", verifiedAt: now, checkedAt: now },
          })
        return `${input.prefix} belongs to ${record.name}`
      },
    }),
  }),
})
