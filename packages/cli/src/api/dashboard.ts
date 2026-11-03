import {
  type Account,
  API_BASE,
  type AppSettings,
  type BecomeDeveloper,
  type CreateApp,
  type DashboardApp,
  type Namespace,
  type ProofMethod,
  type ReleaseDetail,
  type ReleaseSummary,
  type RolloutRequest,
  type TrustedPublisher,
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

  return {
    account: () => get<Account>("/account"),
    becomeDeveloper: (body: BecomeDeveloper) => post<Account["developer"]>("/developer", body),
    namespaces: () => get<Namespace[]>("/namespaces"),
    claimNamespace: (prefix: string) => post<Namespace>("/namespaces", { prefix }),
    verifyNamespace: (prefix: string, method: ProofMethod) =>
      post<Namespace>(`/namespaces/${encodeURIComponent(prefix)}/verify`, { method }),
    apps: () => get<DashboardApp[]>("/apps"),
    createApp: (body: CreateApp) => post<AppSettings>("/apps", body),
    app: (id: string) => get<AppSettings>(app(id)),
    addPublisher: (id: string, body: { repository: string; workflow: string }) =>
      post<TrustedPublisher>(`${app(id)}/publishers`, body),
    releases: (id: string) => get<ReleaseSummary[]>(`${app(id)}/releases`),
    release: (id: string, version: string) =>
      get<ReleaseDetail>(`${app(id)}/releases/${encodeURIComponent(version)}`),
    rollout: (id: string, version: string, body: RolloutRequest) =>
      post<ReleaseDetail>(`${app(id)}/releases/${encodeURIComponent(version)}/rollout`, body),
  }
}

export type Dashboard = ReturnType<typeof dashboard>
