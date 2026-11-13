import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { serveProject } from "../hosting/serve.ts"

const CACHE_SECONDS = 60

interface Mapped {
  publisher: string
  project: string
}

async function lookUp(domain: string): Promise<Mapped | null> {
  const [row] = await db
    .select({
      publisher: schema.publisher.slug,
      project: schema.app.slug,
      active: schema.customDomain.activeAt,
    })
    .from(schema.customDomain)
    .innerJoin(schema.app, eq(schema.app.id, schema.customDomain.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .where(eq(schema.customDomain.domain, domain))
  return row?.active ? { publisher: row.publisher, project: row.project } : null
}

async function mapped(domain: string) {
  const key = new Request(`https://domains.schelf.internal/${domain}`)
  const cached = await caches.default.match(key)
  if (cached) return cached.json<Mapped | null>()
  const found = await lookUp(domain)
  await caches.default.put(
    key,
    Response.json(found, { headers: { "cache-control": `max-age=${CACHE_SECONDS}` } }),
  )
  return found
}

export async function serveDomain(request: Request) {
  const url = new URL(request.url)
  const project = await mapped(url.hostname)
  if (!project) return new Response("This domain isn't connected to a project on Schelf", { status: 404 })
  const path = decodeURIComponent(url.pathname.slice(1)).split("/").filter(Boolean)
  return serveProject(request, [project.publisher, project.project, ...(path.length ? path : ["latest"])])
}
