import { env, withEnv } from "cloudflare:workers"
import site from "#site"
import api from "./api.ts"
import { publishDefinitions } from "./ops/pult.ts"
import { serve, storeHost } from "./serve.ts"
import type { SigningJob } from "./signing/queue.ts"

const API_PATH = /^\/(api|install)(\/|$)/

const siteEnv = {
  ...env,
  API: { fetch: (input: RequestInfo | URL, init?: RequestInit) => serve(new Request(input, init)) },
}

export default {
  ...api,
  fetch(request, environment, context) {
    const url = new URL(request.url)
    if (url.hostname !== storeHost || API_PATH.test(url.pathname))
      return api.fetch(request, environment, context)
    context.waitUntil(publishDefinitions())
    return withEnv(siteEnv, () => site.fetch(request, environment, context)) as Promise<Response>
  },
} satisfies ExportedHandler<Env, SigningJob>
