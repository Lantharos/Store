import {
  type ApplyResponse,
  type applyRequest,
  type ConfigChange,
  type ConfigFiles,
  type ConfigIssue,
  folderOf,
  joinConfigPath,
  LISTING_TOML,
  listingToml,
  manifestName,
  parseConfig,
  type SchelfToml,
  schelfToml,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import type { z } from "zod"
import { approvalUrl, openApproval } from "../approvals/store.ts"
import { listingChanged } from "../dashboard/apps/listing.ts"
import { db, schema } from "../db/client.ts"
import { listingRefusal, requestListing } from "../hosting/listing.ts"
import { fail, failConfig } from "../lib/http.ts"
import { recordHistory } from "../ops/events.ts"
import { appOfManifest } from "../publishing/start.ts"
import { resignApp } from "../signing/queue.ts"
import type { AppRow } from "../signing/records.ts"
import { allowCaller, type Caller, callerOf } from "./caller.ts"
import { type DesiredListing, desiredListing, listingChanges, listingWrites } from "./listing.ts"
import { storedMedia } from "./media.ts"
import { desiredProject, projectChanges, updaterOf, writeProject } from "./project.ts"

type Body = z.output<typeof applyRequest>

function parsed<T>(result: { ok: true; value: T } | { ok: false; issues: ConfigIssue[] }) {
  if (!result.ok) failConfig(result.issues)
  return result.value
}

export function readFiles(body: Pick<Body, "schelf_toml" | "schelf_toml_path" | "listing_toml">) {
  const manifest = parsed(parseConfig(body.schelf_toml_path, schelfToml, body.schelf_toml))
  const folder = manifest.listing && joinConfigPath(folderOf(body.schelf_toml_path), manifest.listing)
  const listingPath = folder ? joinConfigPath(folder, LISTING_TOML) : null
  if (listingPath && body.listing_toml === undefined)
    failConfig([{ file: body.schelf_toml_path, key: "listing", message: `${listingPath} wasn't sent` }])
  const listing = listingPath ? parsed(parseConfig(listingPath, listingToml, body.listing_toml!)) : undefined
  return { manifest, listing, folder, listingPath }
}

export async function appForFiles(manifest: SchelfToml) {
  const app = await appOfManifest(manifest)
  if (!app) fail(404, `${manifestName(manifest)} isn't on schelf.store yet; run schelf init`)
  if (app.kind !== manifest.kind)
    fail(422, `${app.id} is registered as an ${app.kind}, not an ${manifest.kind}`)
  const moving = updaterOf(manifest) !== app.updater && updaterOf(manifest) !== null
  if (app.format !== manifest.format && !moving)
    fail(422, `${app.id} is registered as ${app.format}; schelf.toml says ${manifest.format}`)
  return app
}

async function askToBeListed(
  app: AppRow,
  listing: DesiredListing,
  caller: Caller,
  host: string | undefined,
  result: ApplyResponse,
) {
  if (!listing.listed) {
    if (app.visibility === "listed")
      result.notes.push(`${listing.file}: it's listed in the store; set listed = true to say so`)
    return
  }
  const refusal = await listingRefusal(app)
  if (refusal) {
    if (app.visibility !== "listed" && !app.listingRequestedAt)
      result.notes.push(`${listing.file} listed: ${refusal}`)
    return
  }
  if (caller.kind === "workflow") {
    await requestListing(app, caller.by)
    result.review.push("Asked to be listed; a reviewer looks at the project and its latest release")
  } else if (caller.kind === "person") {
    const row = await openApproval(caller.viewer, [{ type: "listing.request", app: app.id, note: "" }], {
      host,
      place: null,
    })
    result.request = { id: row.id, url: approvalUrl(row.id), expires_at: row.expiresAt.toISOString() }
  } else {
    result.notes.push(`${listing.file} listed: ask with schelf apply while signed in, or in the dashboard`)
  }
}

export async function applyFiles(request: Request, body: Body): Promise<ApplyResponse> {
  const { manifest, listing, folder, listingPath } = readFiles(body)
  const app = await appForFiles(manifest)
  const caller = await callerOf(request, app)
  const issues: ConfigIssue[] = []
  const missing = new Set<string>()
  const desired = listing
    ? desiredListing(listing, {
        folder: folder!,
        file: listingPath!,
        sent: body.media,
        stored: await storedMedia(app),
        missing,
        issues,
      })
    : undefined
  if (issues.length) failConfig(issues)
  const project = await desiredProject(manifest, app, caller, body.schelf_toml_path)
  const changes: ConfigChange[] = [
    ...(await projectChanges(app, project)),
    ...(desired ? await listingChanges(app, desired) : []),
  ]
  if (desired && app.pageIndexed !== desired.indexed)
    changes.push({ file: desired.file, key: "indexed", change: String(desired.indexed) })
  const response = { app: app.id, changes, missing_media: [...missing], review: [], notes: [], request: null }
  if (missing.size || body.dry_run) return { ...response, applied: false }

  await allowCaller(
    caller,
    app,
    changes.some((change) => change.file === body.schelf_toml_path || change.key === "indexed")
      ? "apps"
      : "releases",
  )
  await writeProject(app, project, caller.by)
  const files: ConfigFiles = {
    schelf_toml: body.schelf_toml_path,
    listing_toml: listingPath,
    applied_at: new Date().toISOString(),
  }
  await db.batch([
    db
      .update(schema.app)
      .set({ configFiles: files, ...(desired && { pageIndexed: desired.indexed }) })
      .where(eq(schema.app.id, app.id)),
    ...(desired ? listingWrites(app, desired) : []),
  ])
  const current = (await db.query.app.findFirst({ where: eq(schema.app.id, app.id) }))!
  await Promise.all([listingChanged(current), resignApp(app.id)])
  if (changes.length)
    recordHistory(
      "app",
      app.id,
      `Applied ${changes.length} change${changes.length === 1 ? "" : "s"} from its files`,
      caller.by,
    )
  const result: ApplyResponse = { ...response, applied: true }
  if (desired) await askToBeListed(current, desired, caller, body.host, result)
  return result
}
