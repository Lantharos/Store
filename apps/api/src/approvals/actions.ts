import {
  AGREEMENT_VERSION,
  type ApprovalAction,
  type ApprovalType,
  DEFAULT_LOCALE,
  NEW_PUBLISHER,
  ROLE_NAMES,
  splitProjectPath,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import type { Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { appAccess, membership } from "../publishers/access.ts"

export interface Call {
  method: "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  body?: unknown
}

type Of<Type extends ApprovalType> = Extract<ApprovalAction, { type: Type }>

interface Definition<Type extends ApprovalType> {
  call: (action: Of<Type>) => Call
  describe: (action: Of<Type>) => Promise<string>
}

const app = (id: string) => `/apps/${encodeURIComponent(id)}`
const publisher = (id: string) => `/publishers/${encodeURIComponent(id)}`

async function appName(id: string) {
  const path = splitProjectPath(id)
  const [row] = await db
    .select({ name: schema.listing.name, id: schema.app.id })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(
      path
        ? and(eq(schema.publisher.slug, path.publisher), eq(schema.app.slug, path.project))
        : eq(schema.app.id, id),
    )
  return row?.name ? `${row.name} (${row.id})` : id
}

async function publisherName(id: string) {
  if (id === NEW_PUBLISHER) return "the new publisher"
  return (await db.query.publisher.findFirst({ where: eq(schema.publisher.id, id) }))?.name ?? id
}

async function personName(id: string) {
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, id) })
  return user ? `${user.name} (${user.email})` : id
}

async function releaseName(appId: string, id: string) {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, id) })
  return `${await appName(appId)} ${release?.version ?? id}${release ? ` on ${release.channel}` : ""}`
}

const role = (name: keyof typeof ROLE_NAMES) => ROLE_NAMES[name].label.toLowerCase()

const DEFINITIONS: { [Type in ApprovalType]: Definition<Type> } = {
  "publisher.create": {
    call: ({ kind, name }) => ({
      method: "POST",
      path: "/publishers",
      body: { kind, name, agreement: AGREEMENT_VERSION },
    }),
    describe: async ({ kind, name }) =>
      `Create ${kind === "person" ? "your publisher" : "the organisation"} ${name}, accepting the developer agreement`,
  },
  "publisher.rename": {
    call: ({ publisher: id, name, slug }) => ({ method: "PATCH", path: publisher(id), body: { name, slug } }),
    describe: async ({ publisher: id, name, slug }) =>
      [
        name && `Rename ${await publisherName(id)} to ${name}`,
        slug && `Move its page to schelf.store/publishers/${slug}; old links stop working`,
      ]
        .filter(Boolean)
        .join(". "),
  },
  "namespace.claim": {
    call: ({ publisher: id, prefix }) => ({
      method: "POST",
      path: `${publisher(id)}/namespaces`,
      body: { prefix },
    }),
    describe: async ({ publisher: id, prefix }) =>
      `Claim the ${prefix} namespace for ${await publisherName(id)}`,
  },
  "publisher.domain": {
    call: ({ publisher: id, domain }) => ({
      method: "PUT",
      path: `${publisher(id)}/domain`,
      body: { domain },
    }),
    describe: async ({ publisher: id, domain }) =>
      domain
        ? `Serve the download links of every project of ${await publisherName(id)} on ${domain}, once its DNS records are in`
        : `Stop serving ${await publisherName(id)}'s download links on its own domain`,
  },
  "namespace.verify": {
    call: ({ publisher: id, prefix, method }) => ({
      method: "POST",
      path: `${publisher(id)}/namespaces/${encodeURIComponent(prefix)}/verify`,
      body: { method },
    }),
    describe: async ({ prefix, method }) =>
      `Prove ${prefix} is yours ${method === "github" ? "through your GitHub account" : method === "dns" ? "with its DNS record" : "with the file on its website"}`,
  },
  "namespace.release": {
    call: ({ publisher: id, prefix }) => ({
      method: "DELETE",
      path: `${publisher(id)}/namespaces/${encodeURIComponent(prefix)}`,
    }),
    describe: async ({ publisher: id, prefix }) =>
      `Give up ${prefix} for ${await publisherName(id)}, so anyone can claim it`,
  },
  "app.create": {
    call: ({ publisher: id, app: input }) => ({ method: "POST", path: `${publisher(id)}/apps`, body: input }),
    describe: async ({ publisher: id, app: input }) =>
      `Register ${input.name} as ${input.id} for ${await publisherName(id)}${input.repository ? `, trusting ${input.repository} ${input.workflow ?? ".github/workflows/schelf.yml"} to publish it` : ""}`,
  },
  "project.create": {
    call: ({ publisher: id, project }) => ({
      method: "POST",
      path: `${publisher(id)}/apps/projects`,
      body: project,
    }),
    describe: async ({ publisher: id, project }) =>
      `Create the unlisted project ${project.name} for ${await publisherName(id)}${project.repository ? `, trusting ${project.repository} ${project.workflow ?? ".github/workflows/schelf.yml"} to publish it` : ""}`,
  },
  "project.rename": {
    call: ({ app: id, slug }) => ({ method: "PATCH", path: `${app(id)}/hosting`, body: { slug } }),
    describe: async ({ app: id, slug }) =>
      `Move ${await appName(id)} to the address ${slug}; old links stop working`,
  },
  "project.delete": {
    call: ({ app: id }) => ({ method: "DELETE", path: app(id) }),
    describe: async ({ app: id }) =>
      `Delete ${await appName(id)}: its page, links and feeds stop at once, and it can be restored for 30 days`,
  },
  "project.restore": {
    call: ({ app: id }) => ({ method: "POST", path: `${app(id)}/restore` }),
    describe: async ({ app: id }) => `Restore ${await appName(id)}, bringing back its page, links and feeds`,
  },
  "listing.request": {
    call: ({ app: id, note }) => ({ method: "POST", path: `${app(id)}/listing-request`, body: { note } }),
    describe: async ({ app: id }) =>
      `Ask a reviewer to list ${await appName(id)} in the store, search and Schelf on Luft`,
  },
  "trust.add": {
    call: ({ app: id, rule }) => ({ method: "POST", path: `${app(id)}/trusted-publishers`, body: rule }),
    describe: async ({ app: id, rule }) =>
      `Let ${rule.repository} ${rule.workflow}${rule.environment ? ` in the ${rule.environment} environment` : ""}${rule.ref ? ` on ${rule.ref}` : ""} publish ${await appName(id)}`,
  },
  "trust.remove": {
    call: ({ app: id, rule }) => ({
      method: "DELETE",
      path: `${app(id)}/trusted-publishers/${encodeURIComponent(rule)}`,
    }),
    describe: async ({ app: id, rule }) => {
      const row = await db.query.trustedPublisher.findFirst({ where: eq(schema.trustedPublisher.id, rule) })
      return `Stop ${row ? `${row.repository} ${row.workflow}` : "a workflow"} from publishing ${await appName(id)}`
    },
  },
  "token.create": {
    call: ({ app: id, name }) => ({ method: "POST", path: `${app(id)}/tokens`, body: { name } }),
    describe: async ({ app: id, name }) =>
      `Make an upload token called ${name} that can publish ${await appName(id)} for a year`,
  },
  "channel.invite": {
    call: ({ app: id, channel, email }) => ({
      method: "POST",
      path: `${app(id)}/channels/${channel}/invites`,
      body: { email },
    }),
    describe: async ({ app: id, channel, email }) =>
      `Let ${email} download ${await appName(id)} from its invite-only ${channel} channel, and email them`,
  },
  "channel.token": {
    call: ({ app: id, channel, name }) => ({
      method: "POST",
      path: `${app(id)}/channels/${channel}/tokens`,
      body: { name },
    }),
    describe: async ({ app: id, channel, name }) =>
      `Make a download token called ${name} that can get ${await appName(id)} from its invite-only ${channel} channel`,
  },
  "member.invite": {
    call: ({ publisher: id, to, role }) => ({
      method: "POST",
      path: `${publisher(id)}/invites`,
      body: { ...to, role },
    }),
    describe: async ({ publisher: id, to, role: given }) =>
      `Invite ${"email" in to ? to.email : `@${to.github}`} to ${await publisherName(id)} as ${role(given)}`,
  },
  "member.role": {
    call: ({ publisher: id, user, role }) => ({
      method: "PATCH",
      path: `${publisher(id)}/members/${user}`,
      body: { role },
    }),
    describe: async ({ publisher: id, user, role: given }) =>
      `Make ${await personName(user)} ${role(given)} of ${await publisherName(id)}`,
  },
  "member.remove": {
    call: ({ publisher: id, user }) => ({ method: "DELETE", path: `${publisher(id)}/members/${user}` }),
    describe: async ({ publisher: id, user }) =>
      `Remove ${await personName(user)} from ${await publisherName(id)}`,
  },
  "member.transfer": {
    call: ({ publisher: id, user }) => ({
      method: "POST",
      path: `${publisher(id)}/members/${user}/transfer`,
    }),
    describe: async ({ publisher: id, user }) =>
      `Hand ownership of ${await publisherName(id)} to ${await personName(user)}; you become an admin`,
  },
  "invite.accept": {
    call: ({ invite }) => ({ method: "POST", path: `/invites/${invite}/accept` }),
    describe: async ({ invite }) => {
      const row = await db
        .select({ name: schema.publisher.name, role: schema.invite.role })
        .from(schema.invite)
        .innerJoin(schema.publisher, eq(schema.publisher.id, schema.invite.publisherId))
        .where(eq(schema.invite.id, invite))
      return row[0] ? `Join ${row[0].name} as ${role(row[0].role)}` : "Accept an invitation"
    },
  },
  "release.rollback": {
    call: ({ app: id, release }) => ({
      method: "POST",
      path: `${app(id)}/releases/${release}/rollout`,
      body: { action: "rollback" },
    }),
    describe: async ({ app: id, release }) =>
      `Stop ${await releaseName(id, release)} for everyone and offer the release before it again`,
  },
  "release.inside-luft": {
    call: ({ app: id, release }) => ({ method: "POST", path: `${app(id)}/releases/${release}/inside-luft` }),
    describe: async ({ app: id, release }) =>
      `Ask a reviewer to let ${await releaseName(id, release)} run inside Luft`,
  },
}

const definition = (action: ApprovalAction) => DEFINITIONS[action.type] as Definition<ApprovalType>

export const callOf = (action: ApprovalAction) => definition(action).call(action as never)
export const describeAction = (action: ApprovalAction) => definition(action).describe(action as never)

async function deletedAppAccess(viewer: Viewer, id: string) {
  const row = await db.query.app.findFirst({ where: eq(schema.app.id, id) })
  if (!row) fail(404, "You don't have an app with that id")
  await membership(viewer.id, row.publisherId)
}

export async function checkScopes(viewer: Viewer, actions: ApprovalAction[]) {
  let creating = false
  for (const action of actions) {
    if (action.type === "publisher.create") creating = true
    if (action.type === "project.restore") await deletedAppAccess(viewer, action.app)
    else if ("app" in action && typeof action.app === "string") await appAccess(viewer, action.app)
    else if ("publisher" in action && action.publisher !== NEW_PUBLISHER)
      await membership(viewer.id, action.publisher)
    else if ("publisher" in action && !creating)
      fail(422, `${NEW_PUBLISHER} names a publisher made earlier in the same request`)
  }
}
