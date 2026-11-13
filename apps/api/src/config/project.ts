import {
  type ConfigChange,
  NIGHTLY,
  NIGHTLY_KEEP,
  type SchelfToml,
  UPDATER_NAMES,
  type Updater,
} from "@schelf/protocol"
import { and, count, eq } from "drizzle-orm"
import { githubAccount } from "../dashboard/access.ts"
import { db, schema } from "../db/client.ts"
import { domainOf, refuseTaken, settleDomain } from "../domains/state.ts"
import { repository as githubRepository } from "../github/api.ts"
import { ensureChannel } from "../hosting/channels.ts"
import { endChannel, reopenChannel } from "../hosting/ended.ts"
import { cancelSwitch, latestSwitch, startSwitch } from "../hosting/switches.ts"
import { fail } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"
import type { Caller } from "./caller.ts"

type AppFields = Pick<
  AppRow,
  | "distribution"
  | "licence"
  | "repository"
  | "repositoryId"
  | "latestFollowsRollout"
  | "platforms"
  | "parts"
  | "privacy"
>

export interface DesiredProject {
  file: string
  domain: string | null
  fields: AppFields
  updater: Updater | null
  channels: SchelfToml["channels"]
}

export function updaterOf(manifest: SchelfToml): Updater | null {
  if (manifest.format === "sabine") return "sabine"
  return manifest.format === "files" ? (manifest.updater ?? null) : null
}

async function repositoryOf(manifest: SchelfToml, app: AppRow, caller: Caller, file: string) {
  if (!manifest.repository) return { repository: null, repositoryId: null }
  if (manifest.repository.toLowerCase() === app.repository?.toLowerCase())
    return { repository: app.repository, repositoryId: app.repositoryId }
  if (
    caller.kind === "workflow" &&
    caller.repository.name.toLowerCase() === manifest.repository.toLowerCase()
  )
    return { repository: caller.repository.name, repositoryId: caller.repository.id }
  const token = caller.kind === "person" ? (await githubAccount(caller.viewer.id))?.token : undefined
  const found = await githubRepository(manifest.repository, token)
  if (!found)
    fail(422, `${file} repository: GitHub has no repository ${manifest.repository} that Schelf can see`)
  return { repository: found.full_name, repositoryId: String(found.id) }
}

export async function desiredProject(
  manifest: SchelfToml,
  app: AppRow,
  caller: Caller,
  file: string,
): Promise<DesiredProject> {
  return {
    file,
    domain: manifest.domain ?? null,
    fields: {
      distribution: manifest.distribution,
      licence: manifest.licence ?? null,
      ...(await repositoryOf(manifest, app, caller, file)),
      latestFollowsRollout: manifest.links.follow_rollout,
      platforms: manifest.platforms ?? null,
      parts: manifest.parts,
      privacy: manifest.privacy ?? null,
    },
    updater: updaterOf(manifest),
    channels: manifest.channels,
  }
}

const FIELD_KEYS: Record<keyof AppFields, string | null> = {
  distribution: "distribution",
  licence: "licence",
  repository: "repository",
  repositoryId: null,
  latestFollowsRollout: "links.follow_rollout",
  platforms: "platforms",
  parts: null,
  privacy: null,
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

function partChanges(app: AppRow, desired: DesiredProject, change: (key: string, text: string) => void) {
  const wanted = desired.fields.parts
  for (const name of new Set([...Object.keys(app.parts), ...Object.keys(wanted)])) {
    const before = app.parts[name]
    const after = wanted[name]
    if (!after) change(`parts.${name}`, "removed")
    else if (!before) change(`parts.${name}`, `added for ${after.platforms.join(", ")}`)
    else {
      if (!same(before.platforms, after.platforms))
        change(`parts.${name}.platforms`, after.platforms.join(", "))
      if (!same(before.files, after.files)) change(`parts.${name}.files`, after.files.join(", "))
    }
  }
}

const defaultKeep = (name: string) => (name === NIGHTLY ? NIGHTLY_KEEP : null)

async function domainChange(
  app: AppRow,
  desired: DesiredProject,
  change: (key: string, text: string) => void,
) {
  if (desired.domain) await refuseTaken({ appId: app.id }, desired.domain)
  const current = await domainOf(app.id)
  if ((current?.domain ?? null) !== desired.domain)
    change(
      "domain",
      desired.domain ? "serves the links once its DNS records are in" : "stops serving the links",
    )
}

export async function projectChanges(app: AppRow, desired: DesiredProject): Promise<ConfigChange[]> {
  const changes: ConfigChange[] = []
  const change = (key: string, text: string) => changes.push({ file: desired.file, key, change: text })
  await domainChange(app, desired, change)
  for (const [field, key] of Object.entries(FIELD_KEYS) as [keyof AppFields, string | null][])
    if (key && !same(app[field], desired.fields[field]))
      change(key, [desired.fields[field] ?? "cleared"].flat().join(", "))
  partChanges(app, desired, change)
  if (!same(app.privacy, desired.fields.privacy))
    change(
      "privacy",
      desired.fields.privacy
        ? Object.entries(desired.fields.privacy)
            .map(([key, value]) => `${key} ${value}`)
            .join(", ")
        : "cleared",
    )
  if (desired.updater && desired.updater !== app.updater)
    change("updater", `moves to ${UPDATER_NAMES[desired.updater]}`)
  const [rows, counts] = await Promise.all([
    db.select().from(schema.channel).where(eq(schema.channel.appId, app.id)),
    db
      .select({ channel: schema.release.channel, releases: count() })
      .from(schema.release)
      .where(eq(schema.release.appId, app.id))
      .groupBy(schema.release.channel),
  ])
  const releasesOn = new Map(counts.map((row) => [row.channel, row.releases]))
  const names = new Set([...rows.map((row) => row.name), ...Object.keys(desired.channels)])
  for (const name of names) {
    const row = rows.find((entry) => entry.name === name)
    const wanted = desired.channels[name] ?? {}
    const keep = wanted.keep ?? defaultKeep(name)
    if ((row?.keep ?? defaultKeep(name)) !== keep)
      change(`channels.${name}.keep`, keep === null ? "keeps every release" : `keeps ${keep}`)
    if ((row?.gradual ?? null) !== (wanted.gradual ?? null))
      change(`channels.${name}.gradual`, String(wanted.gradual ?? "default"))
    if ((row?.inviteOnly ?? false) !== (wanted.invite_only ?? false)) {
      if (wanted.invite_only && releasesOn.get(name))
        fail(
          422,
          `${desired.file} channels.${name}.invite_only: ${name} already has releases anyone could download; make a new channel invite-only`,
        )
      change(`channels.${name}.invite_only`, wanted.invite_only ? "only invited people" : "open to everyone")
    }
    if ((row?.endedInto ?? null) !== (wanted.ended_into ?? null))
      change(`channels.${name}.ended_into`, wanted.ended_into ? `ends into ${wanted.ended_into}` : "reopens")
  }
  return changes
}

async function settleChannels(app: AppRow, desired: DesiredProject, by: string) {
  const rows = await db.select().from(schema.channel).where(eq(schema.channel.appId, app.id))
  for (const row of rows)
    if (row.endedInto && row.endedInto !== desired.channels[row.name]?.ended_into)
      await reopenChannel(app, row.name, by)
  for (const [name, settings] of Object.entries(desired.channels)) {
    await ensureChannel(app.id, name)
    if (settings.ended_into && rows.find((row) => row.name === name)?.endedInto !== settings.ended_into) {
      await ensureChannel(app.id, settings.ended_into)
      await endChannel(app, name, settings.ended_into, by)
    }
  }
  const names = [...new Set([...rows.map((row) => row.name), ...Object.keys(desired.channels)])]
  if (!names.length) return
  await db.batch(
    names.map((name) =>
      db
        .update(schema.channel)
        .set({
          keep: desired.channels[name]?.keep ?? defaultKeep(name),
          gradual: desired.channels[name]?.gradual ?? null,
          inviteOnly: desired.channels[name]?.invite_only ?? false,
        })
        .where(and(eq(schema.channel.appId, app.id), eq(schema.channel.name, name))),
    ) as never,
  )
}

async function settleUpdater(app: AppRow, updater: Updater | null, by: string) {
  if (!updater || updater === app.updater) return
  const open = await latestSwitch(app.id)
  if (open && !open.completedAt && open.fromUpdater === updater) await cancelSwitch(app, by)
  else await startSwitch(app, updater, by)
}

export async function writeProject(app: AppRow, desired: DesiredProject, by: string) {
  await settleChannels(app, desired, by)
  await settleUpdater(app, desired.updater, by)
  await settleDomain({ appId: app.id }, desired.domain, by)
  await db.update(schema.app).set(desired.fields).where(eq(schema.app.id, app.id))
}
