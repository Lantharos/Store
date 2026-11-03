import { b, resource } from "@lantharos/pult"
import { APP_STATUSES, UPDATER_NAMES, VISIBILITIES } from "@schelf/protocol"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import { decideListing } from "../../hosting/listing.ts"
import { delist, pull, unpull } from "../../releases/moderation.ts"
import { type AppView, apps } from "../data/apps.ts"
import { APP_FORMAT, APP_KIND, APP_STATUS, SOURCE, VISIBILITY } from "../data/labels.ts"
import { appPage, link, repositoryLink } from "../data/links.ts"
import { releases } from "../data/releases.ts"
import { listingBlocks } from "../render/listing.ts"

const pullInput = z.object({
  reason: z.string().trim().min(1).max(200).describe("For the record; the developer sees it too"),
  note: z.string().trim().min(1).max(500).describe("Shown to everyone who installed it"),
})

const shown = (app: AppView) => app.status === "published" || app.status === "delisted"
const page = (app: AppView) => appPage(app, app.publisherSlug)

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
      visibility: z.enum(VISIBILITIES).optional(),
    }),
    run: ({ query, filters, cursor, limit }) => apps.browse(query, filters, cursor, limit),
  },
  title: (app) => app.name,
  subtitle: (app) =>
    `${app.publisherSlug}/${app.slug} · ${APP_STATUS[app.status]} · ${VISIBILITY[app.visibility]}`,
  fields: (app) => ({
    status: APP_STATUS[app.status],
    visibility: VISIBILITY[app.visibility],
    kind: APP_KIND[app.kind],
    publisher: app.publisher,
    added: app.createdAt,
  }),
  url: page,
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
        project: `${app.publisherSlug}/${app.slug}`,
        publisher: b.ref("publisher", app.publisherId, app.publisher),
        status: APP_STATUS[app.status],
        visibility: VISIBILITY[app.visibility],
        "asks to be listed": app.listingRequestedAt ?? undefined,
        kind: APP_KIND[app.kind],
        format: APP_FORMAT[app.format],
        updates: app.updater ? UPDATER_NAMES[app.updater] : "Downloads only",
        source: SOURCE[app.distribution],
        repository: repositoryLink(app.repository),
        licence: app.licence ?? undefined,
        added: app.createdAt,
        page: link(page(app)),
      }),
      b.table(blocks, { title: "Pulled" }),
      b.table(
        trusted.map((rule) => ({
          repository: repositoryLink(rule.repository),
          workflow: rule.workflow,
          environment: rule.environment ?? "Any",
          ref: rule.ref ?? "Any",
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
    list: action({
      label: "List it",
      description: "Puts the project in the catalog, search and the Schelf app.",
      danger: "confirm",
      when: (app) => app.listingRequestedAt !== null,
      moves: "listed",
      run: async ({ record, actor }) => {
        await decideListing(record.id, { listed: true, by: actor.name })
        return `${record.name} is listed`
      },
    }),
    keepUnlisted: action({
      label: "Keep unlisted",
      description:
        "Declines the request to be listed and tells the publisher why. The project keeps working as it is.",
      input: z.object({ reason: z.string().trim().min(1).max(2000).describe("Sent to the publisher") }),
      danger: "confirm",
      when: (app) => app.listingRequestedAt !== null,
      moves: "kept unlisted",
      run: async ({ record, input, actor }) => {
        await decideListing(record.id, { listed: false, by: actor.name, reason: input.reason })
        return `${record.name} stays unlisted`
      },
    }),
    delist: action({
      description: "Hides the app from the catalog and search. Installs and updates keep working.",
      danger: "confirm",
      when: (app) => app.status === "published",
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
