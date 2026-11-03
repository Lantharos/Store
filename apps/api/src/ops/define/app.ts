import { b, resource } from "@lantharos/pult"
import { APP_STATUSES } from "@schelf/protocol"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { delist, pull, unpull } from "../../releases/moderation.ts"
import { type AppView, apps } from "../data/apps.ts"
import { APP_FORMAT, APP_KIND, APP_STATUS } from "../data/labels.ts"
import { appPage, link, repositoryLink } from "../data/links.ts"
import { releases } from "../data/releases.ts"
import { listingBlocks } from "../render/listing.ts"

const pullInput = z.object({
  reason: z.string().trim().min(1).max(200).describe("For the record; the developer sees it too"),
  note: z.string().trim().min(1).max(500).describe("Shown to everyone who installed it"),
})

const shown = (app: AppView) => app.status === "listed" || app.status === "delisted"

async function blockRows(app: AppView) {
  const blocks = await apps.blocks(app.id)
  return blocks.map((block) => ({
    version: block.releaseId
      ? b.ref("release", block.releaseId, block.version ?? undefined)
      : "Every version",
    reason: block.reason,
    "public note": block.publicNote ?? "",
    since: block.createdAt,
  }))
}

export const app = resource("app", {
  icon: "box",
  get: (id) => apps.byId(id),
  find: (query, limit) => apps.search(query, limit),
  list: {
    filters: z.object({
      status: z.enum(APP_STATUSES).optional(),
      kind: z.enum(["app", "extension"]).optional(),
    }),
    run: ({ query, filters, cursor, limit }) => apps.browse(query, filters, cursor, limit),
  },
  title: (app) => app.name,
  subtitle: (app) => `${app.id} · ${APP_STATUS[app.status]}`,
  fields: (app) => ({
    status: APP_STATUS[app.status],
    kind: APP_KIND[app.kind],
    publisher: app.publisher,
    added: app.createdAt,
  }),
  url: (app) => appPage(app),
  related: {
    releases: { resource: "release", list: (app, limit) => releases.ofApp(app.id, limit ?? 50) },
  },
  render: async (app) => {
    const [installs, reports, blocks, tokens, trusted] = await Promise.all([
      apps.installs(app.id),
      apps.openReports(app.id),
      blockRows(app),
      apps.activeTokens(app.id),
      apps.trustedPublishers(app.id),
    ])
    return [
      b.stats({ "Installs, 30 days": installs, "Open reports": reports }),
      b.fields({
        id: app.id,
        publisher: b.ref("publisher", app.publisherId, app.publisher),
        status: APP_STATUS[app.status],
        kind: APP_KIND[app.kind],
        format: APP_FORMAT[app.format],
        source: app.distribution === "open" ? "Open source" : "Proprietary",
        repository: repositoryLink(app.repository),
        licence: app.licence ?? undefined,
        added: app.createdAt,
        "store page": link(appPage(app)),
      }),
      b.table(blocks, { title: "Pulled" }),
      b.table(
        trusted.map((rule) => ({
          repository: repositoryLink(rule.repository),
          workflow: rule.workflow,
          environment: rule.environment ?? "Any",
          added: rule.createdAt,
        })),
        { title: "Trusted publishers" },
      ),
      b.table(
        tokens.map((token) => ({
          token: token.name,
          "last used": token.lastUsedAt ?? "Never",
          expires: token.expiresAt,
        })),
        { title: "Tokens" },
      ),
      ...(await listingBlocks(app.id)),
    ]
  },
  actions: (action) => ({
    delist: action({
      description: "Hides the app from the catalog and search. Installs and updates keep working.",
      danger: "confirm",
      when: (app) => app.status === "listed",
      run: async ({ record }) => {
        await delist(record.id, false)
        return `${record.name} is delisted`
      },
    }),
    relist: action({
      label: "List again",
      description: "Shows the app in the catalog and search again.",
      danger: "confirm",
      when: (app) => app.status === "delisted",
      run: async ({ record }) => {
        await delist(record.id, true)
        return `${record.name} is listed again`
      },
    }),
    pull: action({
      description:
        "Stops every version from installing and starting, delists the app and shows the note to people who have it.",
      input: pullInput,
      danger: "reauth",
      when: shown,
      run: async ({ record, input }) => {
        await pull({ app: record.id }, input.reason, input.note)
        return `Pulled ${record.name}`
      },
    }),
    unpull: action({
      label: "Undo pull",
      description: "Lets the app install and start again and lists it.",
      danger: "reauth",
      when: (app) => app.status === "pulled",
      run: async ({ record }) => {
        await unpull({ app: record.id })
        return `${record.name} can start again`
      },
    }),
    revokeToken: action({
      label: "Revoke a token",
      description: "Stops one upload token from publishing. The developer can make a new one.",
      input: z.object({ token: z.string() }),
      choices: {
        token: async (app) =>
          (await apps.activeTokens(app.id)).map((token) => ({ value: token.id, label: token.name })),
      },
      danger: "confirm",
      when: (app) => app.activeTokens > 0,
      run: async ({ record, input }) => {
        const [revoked] = await db
          .update(schema.token)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(schema.token.id, input.token),
              eq(schema.token.appId, record.id),
              isNull(schema.token.revokedAt),
            ),
          )
          .returning({ name: schema.token.name })
        if (!revoked) throw new Error("That token is already revoked")
        return `Revoked ${revoked.name}`
      },
    }),
    removeTrustedPublisher: action({
      label: "Remove a trusted publisher",
      description: "Stops one workflow from publishing until the developer adds it again.",
      input: z.object({ publisher: z.string() }),
      choices: {
        publisher: async (app) =>
          (await apps.trustedPublishers(app.id)).map((rule) => ({
            value: rule.id,
            label: `${rule.repository}, ${rule.workflow}`,
          })),
      },
      danger: "confirm",
      when: (app) => app.trustedPublishers > 0,
      run: async ({ record, input }) => {
        const [removed] = await db
          .delete(schema.trustedPublisher)
          .where(
            and(
              eq(schema.trustedPublisher.id, input.publisher),
              eq(schema.trustedPublisher.appId, record.id),
            ),
          )
          .returning({ repository: schema.trustedPublisher.repository })
        if (!removed) throw new Error("That trusted publisher is already gone")
        return `${removed.repository} can't publish ${record.name} any more`
      },
    }),
  }),
})
