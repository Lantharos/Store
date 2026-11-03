import { STORE_ORIGIN } from "@schelf/protocol"
import { FILE_CACHE } from "#lib/server/cache.ts"

export const prerender = true

export const GET = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /search
Disallow: /report/
Disallow: /device
Disallow: /api/

Sitemap: ${STORE_ORIGIN}/sitemap.xml
`,
    { headers: { "content-type": "text/plain", "cache-control": FILE_CACHE } },
  )
