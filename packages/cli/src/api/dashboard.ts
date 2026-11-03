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
  type UpdateListing,
  type UpdateMeta,
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
    becomeDeveloper: (body: BecomeDeveloper) => post<Account["developer"]>("/account/developer", body),
    namespaces: () => get<Namespace[]>("/namespaces"),
    claimNamespace: (prefix: string) => post<Namespace>("/namespaces", { prefix }),
    verifyNamespace: (prefix: string, method: ProofMethod) =>
      post<Namespace>(`/namespaces/${encodeURIComponent(prefix)}/verify`, { method }),
    apps: () => get<DashboardApp[]>("/apps"),
    createApp: (body: CreateApp) => post<AppSettings>("/apps", body),
    app: (id: string) => get<AppSettings>(app(id)),
    addPublisher: (id: string, body: { repository: string; workflow: string }) =>
      post<TrustedPublisher>(`${app(id)}/publishers`, body),
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
