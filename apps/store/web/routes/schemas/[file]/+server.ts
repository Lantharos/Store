import { CONFIG_SCHEMAS, type ConfigFile, jsonSchemaOf } from "@schelf/protocol"
import { error } from "@sveltejs/kit"

export const prerender = true

const FILES = Object.keys(CONFIG_SCHEMAS) as ConfigFile[]

export const entries = () => FILES.map((file) => ({ file: `${file}.json` }))

export function GET({ params }) {
  const file = FILES.find((name) => `${name}.json` === params.file)
  if (!file) error(404, "Not found")
  return new Response(JSON.stringify(jsonSchemaOf(file), null, 2), {
    headers: { "content-type": "application/schema+json" },
  })
}
