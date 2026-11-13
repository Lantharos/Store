import { parse } from "smol-toml"
import { z } from "zod"
import { partName, partSettings } from "../parts.ts"
import { appId, distribution, format, formatFits, kind, platform, platformsFor } from "../platforms.ts"
import { privacy } from "../privacy.ts"
import { projectPath } from "../projects.ts"
import { channelName, STABLE } from "../releases.ts"

export const SCHELF_TOML = "schelf.toml"

const sabineVersion = z.string().regex(/^v?\d+\.\d+(\.0)?$/, "A Sabine version looks like 0.68")

export const repositoryName = z
  .string()
  .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "A repository is owner/name, like alice/notes")

export const requires = z.strictObject({
  sabine: sabineVersion.optional().describe("The oldest Sabine version the app runs on"),
  extension_api: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The Luft extension API version an extension was built for"),
})
export type Requires = z.infer<typeof requires>

export const FILE_UPDATERS = ["electron", "tauri"] as const

export const channelSettings = z.strictObject({
  keep: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Keep only the newest releases on this channel, deleting older ones"),
  gradual: z
    .boolean()
    .optional()
    .describe("Roll releases out step by step (10%, 25%, 50%, everyone) instead of to everyone at once"),
  ended_into: channelName
    .optional()
    .describe("End this channel: publishing to it is refused and its people move to the named channel"),
})
export type ChannelSettings = z.infer<typeof channelSettings>

export const schelfToml = z
  .strictObject({
    id: appId.optional().describe("The reverse-DNS app id, like io.github.alice.Notes"),
    project: projectPath
      .optional()
      .describe("The project's address, like alice/notes, for projects without an id"),
    kind: kind.default("app"),
    format,
    updater: z
      .enum(FILE_UPDATERS)
      .optional()
      .describe("The updater a files project ships with, whose feeds Schelf serves"),
    permissions: z.string().min(1).optional().describe("The file holding the permission declaration"),
    listing: z
      .string()
      .min(1)
      .optional()
      .describe("The folder holding listing.toml, the icon and screenshots"),
    distribution: distribution
      .default("open")
      .describe("open for open source, proprietary for closed source"),
    licence: z.string().trim().min(1).max(100).optional().describe("An SPDX licence expression, like MIT"),
    repository: repositoryName.optional().describe("The GitHub repository the source lives in"),
    requires: requires.default({}),
    links: z
      .strictObject({
        follow_rollout: z
          .boolean()
          .default(false)
          .describe("Download links serve a release while it rolls out, to its percentage of visitors"),
      })
      .default({ follow_rollout: false }),
    channels: z.record(channelName, channelSettings).default({}),
    platforms: z
      .array(platform)
      .min(1)
      .optional()
      .describe("The systems every release carries the app for; a system left out stops being offered"),
    privacy: privacy
      .optional()
      .describe("What the app does with people's data, shown on its page: telemetry, ads and AI features"),
    parts: z
      .record(partName, partSettings)
      .default({})
      .describe("Named groups of files inside each release, like a cli or a runtime, beside the app itself"),
  })
  .superRefine((manifest, context) => {
    if (!manifest.id === !manifest.project)
      context.addIssue({
        code: "custom",
        path: ["project"],
        message: 'Name it with either id = "io.github.alice.Notes" or project = "alice/notes"',
      })
    if (manifest.kind === "extension" && !manifest.id)
      context.addIssue({ code: "custom", path: ["id"], message: "An extension has a reverse-DNS id" })
    if (!formatFits(manifest.kind, manifest.format))
      context.addIssue({
        code: "custom",
        path: ["format"],
        message:
          manifest.kind === "extension"
            ? 'An extension\'s format is "luft-extension"'
            : '"luft-extension" is only for extensions',
      })
    if (manifest.kind === "extension" && manifest.requires.extension_api === undefined)
      context.addIssue({
        code: "custom",
        path: ["requires", "extension_api"],
        message: "An extension names the extension API version it was built for",
      })
    if (manifest.updater && manifest.format !== "files")
      context.addIssue({
        code: "custom",
        path: ["updater"],
        message: `A ${manifest.format} app updates through ${manifest.format === "sabine" ? "Sabine" : "Schelf"}; updater is for format = "files"`,
      })
    if (manifest.distribution === "proprietary" && manifest.licence)
      context.addIssue({
        code: "custom",
        path: ["licence"],
        message: 'A licence is for open source; remove it or set distribution = "open"',
      })
    for (const [index, each] of (manifest.platforms ?? []).entries())
      if (!platformsFor(manifest.format).includes(each))
        context.addIssue({
          code: "custom",
          path: ["platforms", index],
          message: `A ${manifest.format} app isn't built for ${each}`,
        })
    const parts = Object.keys(manifest.parts)
    if (parts.length && manifest.kind === "extension")
      context.addIssue({ code: "custom", path: ["parts"], message: "An extension is one part" })
    if (parts.length && !manifest.platforms && manifest.listing)
      context.addIssue({
        code: "custom",
        path: ["listing"],
        message:
          "A project of only named parts has no store page; add platforms for the app or remove listing",
      })
    for (const [name, settings] of Object.entries(manifest.channels)) {
      if (name === STABLE && (settings.ended_into || settings.keep))
        context.addIssue({
          code: "custom",
          path: ["channels", name],
          message: "stable keeps every release and can't be ended",
        })
      if (settings.ended_into === name)
        context.addIssue({
          code: "custom",
          path: ["channels", name, "ended_into"],
          message: "A channel can't end into itself",
        })
      const into = settings.ended_into ? manifest.channels[settings.ended_into] : undefined
      if (into?.ended_into)
        context.addIssue({
          code: "custom",
          path: ["channels", name, "ended_into"],
          message: `${settings.ended_into} has ended too; end into a channel that's still open`,
        })
    }
  })
export type SchelfToml = z.infer<typeof schelfToml>

export function manifestName(manifest: Pick<SchelfToml, "id" | "project">) {
  return (manifest.id ?? manifest.project)!
}

export function readSchelfToml(text: string): SchelfToml {
  return schelfToml.parse(parse(text))
}
