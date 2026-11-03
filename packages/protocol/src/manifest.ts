import { parse } from "smol-toml"
import { z } from "zod"
import { appId, format, formatFits, kind } from "./platforms.ts"

export const SCHELF_TOML = "schelf.toml"

const sabineVersion = z.string().regex(/^v?\d+\.\d+(\.0)?$/, "A Sabine version looks like 0.68")

export const requires = z.strictObject({
  sabine: sabineVersion.optional(),
  extension_api: z.number().int().positive().optional(),
})
export type Requires = z.infer<typeof requires>

export const schelfToml = z
  .strictObject({
    id: appId,
    kind: kind.default("app"),
    format,
    permissions: z.string().min(1).optional(),
    listing: z.string().min(1).optional(),
    requires: requires.default({}),
  })
  .superRefine((manifest, context) => {
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
  })
export type SchelfToml = z.infer<typeof schelfToml>

export function readSchelfToml(text: string): SchelfToml {
  return schelfToml.parse(parse(text))
}
