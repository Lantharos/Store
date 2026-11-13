import { z } from "zod"
import { appId, FILE_PLATFORMS, PLATFORMS, type Platform, platform } from "./platforms.ts"
import { FILE_UPDATERS, type Updater } from "./releases.ts"

export const PART_FORMATS = ["files", "sabine"] as const

const SYSTEM_WORDS = ["windows", "macos", "linux", "android", "luft", "phone", "other"]
const TAKEN = new Set<string>([...PLATFORMS, ...SYSTEM_WORDS])

export const partName = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,19}$/, "A part is a short lowercase name, like cli or runtime")
  .refine((name) => !TAKEN.has(name), "A part can't be named like a system")

const fileName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9*?][A-Za-z0-9._+*?-]*$/, "A file name, with * for any run of characters")

export const partSettings = z.strictObject({
  files: z
    .array(fileName)
    .min(1)
    .describe("The names of this part's files, with * for any run of characters, like schelf-cli-*"),
  platforms: z
    .array(platform.extract(FILE_PLATFORMS))
    .min(1)
    .describe("The systems every release carries this part for"),
  id: appId.optional().describe("A Sabine part's own app id, which its Sabine.toml and update feed carry"),
  format: z
    .enum(PART_FORMATS)
    .optional()
    .describe("files (the default), or sabine for a Sabine app that updates through its own feed"),
  updater: z
    .enum(FILE_UPDATERS)
    .optional()
    .describe("The updater a part of files ships with, whose feeds Schelf serves under the part"),
})
export type PartSettings = z.infer<typeof partSettings>

export interface PartPlan {
  platforms: Platform[] | null
  parts: Record<string, PartSettings>
}

export const partFormat = (part: Pick<PartSettings, "format">) => part.format ?? "files"

export function partUpdater(part: Pick<PartSettings, "format" | "updater">): Updater | null {
  return partFormat(part) === "sabine" ? "sabine" : (part.updater ?? null)
}

export const hasAppPart = (plan: PartPlan) => plan.platforms !== null || !Object.keys(plan.parts).length

function namePattern(glob: string) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*").replaceAll("?", ".")}$`)
}

export class PartMismatch extends Error {}

export function partOf(name: string, plan: Pick<PartPlan, "parts">): string | null {
  const matches = Object.entries(plan.parts).filter(([, settings]) =>
    settings.files.some((glob) => namePattern(glob).test(name)),
  )
  if (matches.length > 1)
    throw new PartMismatch(`${name} matches the files of ${matches.map(([part]) => part).join(" and ")}`)
  return matches[0]?.[0] ?? null
}

export function platformsOfPart(plan: PartPlan, part: string | null) {
  return part === null ? plan.platforms : (plan.parts[part]?.platforms ?? [])
}

export function offeredIn(plan: PartPlan, file: { part: string | null; platform: string }) {
  if (file.part === null && !hasAppPart(plan)) return false
  const platforms = platformsOfPart(plan, file.part)
  return platforms === null || platforms.includes(file.platform as Platform)
}

export function missingPlatforms(plan: PartPlan, files: { part: string | null; platform: string }[]) {
  const wanted: [string | null, Platform[] | null][] = [
    ...(hasAppPart(plan) ? [[null, plan.platforms] as [null, Platform[] | null]] : []),
    ...Object.entries(plan.parts).map(
      ([part, settings]) => [part, settings.platforms] as [string, Platform[]],
    ),
  ]
  return wanted.flatMap(([part, platforms]) =>
    (platforms ?? [])
      .filter((each) => !files.some((file) => file.part === part && file.platform === each))
      .map((each) => ({ part, platform: each })),
  )
}

export const partLabel = (part: string | null) => part ?? "the app"
