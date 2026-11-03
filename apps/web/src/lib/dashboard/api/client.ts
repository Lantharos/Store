import { API_BASE } from "@schelf/protocol"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

async function send<T>(method: Method, path: string, body?: BodyInit, type?: string): Promise<T> {
  const response = await fetch(`${API_BASE}/dev${path}`, {
    method,
    credentials: "same-origin",
    headers: type ? { "content-type": type } : undefined,
    body,
  })
  if (response.status === 204) return undefined as T
  const json = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok)
    throw new ApiError(json?.error ?? "That didn't work. Try again in a moment.", response.status)
  return json as T
}

export const api = {
  get: <T>(path: string) => send<T>("GET", path),
  post: <T>(path: string, body?: unknown) =>
    send<T>("POST", path, body === undefined ? undefined : JSON.stringify(body), "application/json"),
  put: <T>(path: string, body: unknown) => send<T>("PUT", path, JSON.stringify(body), "application/json"),
  patch: <T>(path: string, body: unknown) => send<T>("PATCH", path, JSON.stringify(body), "application/json"),
  delete: <T = void>(path: string) => send<T>("DELETE", path),
  upload: <T>(path: string, file: File) => send<T>("POST", path, file, file.type),
}
