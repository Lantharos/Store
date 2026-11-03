import { b, resource } from "@lantharos/pult"
import { APP_STATUSES } from "@schelf/protocol"
import { z } from "zod"
import { delist, pull, unpull } from "../../releases/moderation.ts"
import { listingBlocks } from "../data/listing.ts"
import { apps } from "../data/records.ts"

export const app = resource("app", {
  icon: "box",
  get: (id) => apps.byId(id),
  find: (query, limit) => apps.search(query, limit),
  list: {
    filters: z.object({ status: z.enum(APP_STATUSES).optional() }),
    run: ({ filters, cursor, limit }) => apps.browse(filters.status, cursor, limit),
  },
  title: (app) => app.name,
  subtitle: (app) => `${app.id} · ${app.status}`,
  fields: (app) => ({ status: app.status, kind: app.kind, publisher: app.publisher, created: app.createdAt }),
  related: {
    releases: { resource: "release", list: (app) => apps.releases(app.id) },
  },
  render: async (app) => {
    const [releases, installs] = await Promise.all([apps.releases(app.id), apps.installs(app.id)])
    return [
      b.stats({ "Installs, 30 days": installs, Releases: releases.length }),
      b.fields({
        id: app.id,
        publisher: b.ref("publisher", app.publisherId, app.publisher),
        kind: app.kind,
        format: app.format,
        status: app.status,
        repository: app.repository ? `https://github.com/${app.repository}` : undefined,
        licence: app.licence ?? undefined,
      }),
      b.table(
        releases.map((release) => ({
          version: b.ref("release", release.id, release.version),
          status: release.status,
          rollout: release.approvedAt ? `${release.rolloutPercent}%` : "",
          created: release.createdAt,
        })),
      ),
      ...(await listingBlocks(app.id)),
    ]
  },
  actions: (action) => ({
    delist: action({
      description: "Hides the app from the catalog and search. Installs and updates keep working.",
      danger: "confirm",
      run: async ({ record }) => {
        await delist(record.id, false)
        return `${record.name} is delisted`
      },
    }),
    relist: action({
      danger: "confirm",
      run: async ({ record }) => {
        await delist(record.id, true)
        return `${record.name} is listed again`
      },
    }),
    pull: action({
      description:
        "Blocks every version from installing and starting, delists the app and writes a public note.",
      input: z.object({ reason: z.string().trim().min(1).max(200), note: z.string().trim().min(1).max(500) }),
      danger: "reauth",
      run: async ({ record, input }) => {
        await pull({ app: record.id }, input.reason, input.note)
        return `Pulled ${record.name}`
      },
    }),
    unpull: action({
      danger: "reauth",
      run: async ({ record }) => {
        await unpull({ app: record.id })
        return `${record.name} can start again`
      },
    }),
  }),
})
