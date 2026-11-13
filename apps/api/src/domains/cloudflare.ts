import { env } from "cloudflare:workers"

interface Hostname {
  id: string
  status: string
  ssl?: { status: string }
  verification_errors?: string[]
}

interface Answer<T> {
  success: boolean
  result: T
  errors: { message: string }[]
}

export const hostnamesConfigured = () => Boolean(env.CUSTOM_HOSTNAMES_TOKEN)

async function call<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/custom_hostnames${path}`,
    {
      ...init,
      headers: { authorization: `Bearer ${env.CUSTOM_HOSTNAMES_TOKEN}`, "content-type": "application/json" },
    },
  )
  const answer = (await response.json()) as Answer<T>
  if (!answer.success) throw new Error(answer.errors.map((error) => error.message).join("; "))
  return answer.result
}

export const createHostname = (domain: string) =>
  call<Hostname>("", {
    method: "POST",
    body: JSON.stringify({ hostname: domain, ssl: { method: "http", type: "dv" } }),
  })

export const hostname = (id: string) => call<Hostname>(`/${id}`)

export const deleteHostname = (id: string) => call<{ id: string }>(`/${id}`, { method: "DELETE" })
