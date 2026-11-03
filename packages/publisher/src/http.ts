import type { ApiError } from "@schelf/protocol"

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: NonNullable<ApiError["issues"]> = [],
  ) {
    super(message)
  }

  get detail() {
    return [this.message, ...this.issues.map((issue) => `${issue.path}: ${issue.message}`)].join("\n")
  }
}

async function failureFrom(response: Response) {
  const text = await response.text()
  try {
    const body = JSON.parse(text) as ApiError
    return new ApiFailure(response.status, body.error, body.issues)
  } catch {
    return new ApiFailure(response.status, text.trim() || `${response.status} ${response.statusText}`)
  }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])
const ATTEMPTS = 4

export async function request<T>(url: string, init: RequestInit & { token?: string }): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.token) headers.set("authorization", `Bearer ${init.token}`)
  if (typeof init.body === "string") headers.set("content-type", "application/json")
  for (let attempt = 1; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, { ...init, headers })
    } catch (error) {
      if (attempt === ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      continue
    }
    if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T
    if (!RETRYABLE.has(response.status) || attempt === ATTEMPTS) throw await failureFrom(response)
    await response.body?.cancel()
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
}
