import {
  type Account,
  API_BASE,
  type AppSettings,
  type CreateApp,
  type CreateProject,
  type CreatePublisher,
  type DashboardApp,
  type DashboardPublisher,
  type Namespace,
  type ProofMethod,
  type ReleaseDetail,
  type ReleaseSummary,
  type RolloutRequest,
  type TrustedPublisher,
  type UpdateListing,
  type UpdateMeta,
  type Updater,
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
    createPublisher: (body: CreatePublisher) => post<DashboardPublisher>("/publishers", body),
    namespaces: (owner: string) => get<Namespace[]>(`${publisher(owner)}/namespaces`),
    claimNamespace: (owner: string, prefix: string) =>
      post<Namespace>(`${publisher(owner)}/namespaces`, { prefix }),
    verifyNamespace: (owner: string, prefix: string, method: ProofMethod) =>
      post<Namespace>(`${publisher(owner)}/namespaces/${encodeURIComponent(prefix)}/verify`, { method }),
    apps: (owner: string) => get<DashboardApp[]>(`${publisher(owner)}/apps`),
    createApp: (owner: string, body: CreateApp) => post<AppSettings>(`${publisher(owner)}/apps`, body),
    createProject: (owner: string, body: CreateProject) =>
      post<AppSettings>(`${publisher(owner)}/apps/projects`, body),
    app: (id: string) => get<AppSettings>(app(id)),
    switchUpdater: (id: string, to: Updater) => post<AppSettings>(`${app(id)}/switch`, { to }),
    addTrustedPublisher: (id: string, body: { repository: string; workflow: string }) =>
      post<TrustedPublisher>(`${app(id)}/trusted-publishers`, body),
    putListing: (id: string, locale: string, body: UpdateListing) =>
      request(`${base}${app(id)}/listing/${locale}`, { method: "PUT", token, body: JSON.stringify(body) }),
    patchMeta: (id: string, body: UpdateMeta) =>
      request(`${base}${app(id)}/meta`, { method: "PATCH", token, body: JSON.stringify(body) }),
    putIcon: (id: string, bytes: Uint8Array<ArrayBuffer>) =>
      request(`${base}${app(id)}/icon`, { method: "PUT", token, body: bytes }),
    addScreenshot: (id: string, bytes: Uint8Array<ArrayBuffer>, size: { width: number; height: number }) =>
      request(`${base}${app(id)}/screenshots?width=${size.width}&height=${size.height}`, {
        method: "POST",
        token,
        body: bytes,
      }),
    releases: (id: string) => get<ReleaseSummary[]>(`${app(id)}/releases`),
    release: (id: string, release: string) => get<ReleaseDetail>(`${app(id)}/releases/${release}`),
    rollout: (id: string, release: string, body: RolloutRequest) =>
      post<ReleaseDetail>(`${app(id)}/releases/${release}/rollout`, body),
  }
}

export type Dashboard = ReturnType<typeof dashboard>
