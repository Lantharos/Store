import { env } from "cloudflare:workers"

const API = "https://api.github.com"

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`GitHub answered ${status} for ${path}`)
  }
}

export async function github<T>(path: string, init: RequestInit & { token?: string | null } = {}) {
  const token = init.token === undefined ? env.GITHUB_TOKEN || null : init.token
  const headers = new Headers(init.headers)
  headers.set("accept", "application/vnd.github+json")
  headers.set("x-github-api-version", "2022-11-28")
  headers.set("user-agent", "schelf.store")
  if (token) headers.set("authorization", `Bearer ${token}`)
  const response = await fetch(`${API}${path}`, { ...init, headers })
  if (!response.ok) throw new GitHubError(response.status, path)
  return (response.status === 204 ? null : await response.json()) as T
}

export async function maybeGithub<T>(path: string, init: RequestInit & { token?: string | null } = {}) {
  try {
    return await github<T>(path, init)
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null
    throw error
  }
}

export interface Repository {
  id: number
  full_name: string
  private: boolean
  fork: boolean
  default_branch: string
  owner: { id: number; login: string; type: "User" | "Organization" }
}

export function repository(fullName: string, token?: string | null) {
  return maybeGithub<Repository>(`/repos/${fullName}`, { token })
}
