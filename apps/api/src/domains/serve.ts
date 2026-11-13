import { env } from "cloudflare:workers"
import { eq, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { serveProject } from "../hosting/serve.ts"

const CACHE_SECONDS = 60

interface Mapped {
  publisher: string
  project: string | null
}

async function lookUp(domain: string): Promise<Mapped | null> {
  const [row] = await db
    .select({
      publisher: schema.publisher.slug,
      project: schema.app.slug,
      active: schema.customDomain.activeAt,
      verified: schema.publisher.verifiedAt,
    })
    .from(schema.customDomain)
    .leftJoin(schema.app, eq(schema.app.id, schema.customDomain.appId))
    .innerJoin(
      schema.publisher,
      eq(schema.publisher.id, sql`coalesce(${schema.customDomain.publisherId}, ${schema.app.publisherId})`),
    )
    .where(eq(schema.customDomain.domain, domain))
  return row?.active && row.verified ? { publisher: row.publisher, project: row.project } : null
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
  const owner = await mapped(url.hostname)
  if (!owner) return new Response("This domain isn't connected to Schelf", { status: 404 })
  const path = decodeURIComponent(url.pathname.slice(1)).split("/").filter(Boolean)
  if (owner.project)
    return serveProject(request, [owner.publisher, owner.project, ...(path.length ? path : ["latest"])])
  if (!path.length) return Response.redirect(`${env.PUBLIC_URL}/publishers/${owner.publisher}`, 302)
  return serveProject(request, [owner.publisher, ...(path.length === 1 ? [...path, "latest"] : path)])
}
