import { env } from "cloudflare:workers"
import { API_BASE, DOWNLOAD_ORIGIN, STORE_ORIGIN } from "@schelf/protocol"
import { error } from "@sveltejs/kit"

async function read<T>(url: string, missing: string): Promise<T> {
  const response = await env.API.fetch(url, { headers: { accept: "application/json" } })
  if (response.status === 404) error(404, missing)
  if (!response.ok) error(502, "The store didn't answer. Try again in a moment.")
  return response.json()
}

export async function find<T>(path: string): Promise<T | null> {
  const response = await env.API.fetch(`${STORE_ORIGIN}${API_BASE}${path}`, {
    headers: { accept: "application/json" },
  })
  if (response.status === 404) return null
  if (!response.ok) error(502, "The store didn't answer. Try again in a moment.")
  return response.json()
}

export function get<T>(path: string, missing = "Nothing here"): Promise<T> {
  return read<T>(`${STORE_ORIGIN}${API_BASE}${path}`, missing)
}

export function file<T>(key: string): Promise<T> {
  return read<T>(`${DOWNLOAD_ORIGIN}/${key}`, "Nothing here")
}

export async function post(path: string, body: unknown) {
  return env.API.fetch(`${STORE_ORIGIN}${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function media(url: string) {
  const response = await env.API.fetch(url)
  if (!response.ok) return null
  const type = response.headers.get("content-type") ?? "application/octet-stream"
  const bytes = new Uint8Array(await response.arrayBuffer())
  return `data:${type};base64,${bytes.toBase64()}`
}
