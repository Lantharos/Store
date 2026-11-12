import {
  type Account,
  API_BASE,
  type AppSettings,
  type DashboardApp,
  type Namespace,
  type ProofMethod,
  type ReleaseDetail,
  type ReleaseSummary,
  type RolloutRequest,
} from "@schelf/protocol"
import { request } from "@schelf/publisher"

export function dashboard(api: string, token: string) {
  const base = `${api}${API_BASE}/dev`
  const get = <T>(path: string) => request<T>(`${base}${path}`, { token })
  const post = <T>(path: string, body?: unknown) =>
    request<T>(`${base}${path}`, {
      method: "POST",
      token,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const app = (id: string) => `/apps/${encodeURIComponent(id)}`
  const publisher = (id: string) => `/publishers/${encodeURIComponent(id)}`

  return {
    account: () => get<Account>("/account"),
    namespaces: (owner: string) => get<Namespace[]>(`${publisher(owner)}/namespaces`),
    verifyNamespace: (owner: string, prefix: string, method: ProofMethod) =>
      post<Namespace>(`${publisher(owner)}/namespaces/${encodeURIComponent(prefix)}/verify`, { method }),
    apps: (owner: string) => get<DashboardApp[]>(`${publisher(owner)}/apps`),
    app: (id: string) => get<AppSettings>(app(id)),
    releases: (id: string) => get<ReleaseSummary[]>(`${app(id)}/releases`),
    release: (id: string, release: string) => get<ReleaseDetail>(`${app(id)}/releases/${release}`),
    rollout: (id: string, release: string, body: RolloutRequest) =>
      post<ReleaseDetail>(`${app(id)}/releases/${release}/rollout`, body),
  }
}

export type Dashboard = ReturnType<typeof dashboard>
