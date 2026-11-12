import { z } from "zod"
import { STORE_ORIGIN } from "../paths.ts"
import { LISTING_TOML, listingToml } from "./listing-toml.ts"
import { SCHELF_TOML, schelfToml } from "./schelf-toml.ts"

export const CONFIG_SCHEMAS = {
  [SCHELF_TOML]: { schema: schelfToml, title: "schelf.toml: how a project is built and published" },
  [LISTING_TOML]: { schema: listingToml, title: "listing.toml: the project's store page" },
} as const
export type ConfigFile = keyof typeof CONFIG_SCHEMAS

export const schemaUrl = (file: ConfigFile) => `${STORE_ORIGIN}/schemas/${file}.json`

export const schemaDirective = (file: ConfigFile) => `#:schema ${schemaUrl(file)}\n`

export function jsonSchemaOf(file: ConfigFile) {
  const { schema, title } = CONFIG_SCHEMAS[file]
  return { $id: schemaUrl(file), title, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) }
}
