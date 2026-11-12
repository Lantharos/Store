import {
  type ChannelSettings,
  isProjectId,
  NIGHTLY,
  NIGHTLY_KEEP,
  type SetupFiles,
  schelfTomlFor,
  workflowFor,
} from "@schelf/protocol"
import type { schema } from "../../db/client.ts"
import type { AppRow } from "../../signing/records.ts"

const FIRST_EXTENSION_API = 1

export function setupFiles(
  app: AppRow,
  publisherSlug: string,
  workflow: string,
  environment: string | null,
  channels: (typeof schema.channel.$inferSelect)[],
): SetupFiles {
  const settings = Object.fromEntries(
    channels.flatMap((row): [string, ChannelSettings][] => {
      const keep =
        row.keep !== (row.name === NIGHTLY ? NIGHTLY_KEEP : null) ? (row.keep ?? undefined) : undefined
      const entry = { keep, gradual: row.gradual ?? undefined, ended_into: row.endedInto ?? undefined }
      return Object.values(entry).some((value) => value !== undefined) ? [[row.name, entry]] : []
    }),
  )
  const input = {
    id: app.id,
    project: isProjectId(app.id) ? `${publisherSlug}/${app.slug}` : undefined,
    kind: app.kind,
    format: app.format,
    environment,
    extensionApi: app.kind === "extension" ? FIRST_EXTENSION_API : undefined,
    updater: app.format === "files" && app.updater !== "sabine" ? (app.updater ?? undefined) : undefined,
    distribution: app.distribution,
    licence: app.licence ?? undefined,
    repository: app.repository ?? undefined,
    followRollout: app.latestFollowsRollout,
    channels: settings,
  }
  return { schelf_toml: schelfTomlFor(input), workflow_path: workflow, workflow_yml: workflowFor(input) }
}
