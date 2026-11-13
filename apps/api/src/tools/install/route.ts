import { env } from "cloudflare:workers"
import {
  channelName,
  paths,
  pickFile,
  STABLE,
  STORE_TOOL,
  splitToolAddress,
  type ToolIndex,
  toolName,
  toolReleaseOn,
} from "@schelf/protocol"
import { Hono } from "hono"
import { type Bootstrap, installScript, POSIX_TARGETS } from "./script.ts"

const SCRIPT_CACHE = "public, max-age=60"

export const installRoutes = new Hono()

async function readIndex(key: string) {
  const object = await env.BUCKET.get(key)
  return object ? object.json<ToolIndex>() : null
}

function indexKeyOf(handle: string) {
  const address = splitToolAddress(handle)
  if (address) return paths.tool(address.publisher, address.name)
  return toolName.safeParse(handle).success ? paths.shortTool(handle) : null
}

function filesOf(release: ToolIndex["releases"][number]) {
  return Object.fromEntries(
    POSIX_TARGETS.flatMap((target) => {
      const file = pickFile(release.files, target)
      return file ? [[target, file]] : []
    }),
  ) as Bootstrap["files"]
}

const refuse = (status: 404 | 503, message: string) =>
  new Response(`${message}\n`, { status, headers: { "content-type": "text/plain; charset=utf-8" } })

async function serve(handle: string | null, channel: string) {
  const schelf = await readIndex(paths.tool(STORE_TOOL.publisher, STORE_TOOL.name))
  const release = schelf && toolReleaseOn(schelf, channel)
  if (!release) return refuse(503, `schelf isn't published on ${channel} yet`)
  let then: Bootstrap["then"] = null
  if (handle) {
    const key = indexKeyOf(handle)
    const tool = key ? await readIndex(key) : null
    if (!tool?.releases.length) return refuse(404, `There's no tool called ${handle} on schelf.store`)
    then = { tool: handle, publisher: tool.publisher.name, verified: tool.publisher.verified }
  }
  const script = installScript({ version: release.version, files: filesOf(release), then })
  return new Response(script, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": SCRIPT_CACHE },
  })
}

installRoutes.get("/install/*", (c) => {
  const channel = channelName.safeParse(c.req.query("channel") ?? STABLE)
  if (!channel.success) return refuse(404, "There's no such channel")
  const handle = decodeURIComponent(c.req.path.slice("/install".length).replace(/^\/|\/$/g, ""))
  return serve(handle || null, channel.data)
})
