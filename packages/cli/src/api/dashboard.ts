import {
  type Account,
  API_BASE,
  type Approval,
  type AppSettings,
  type ChannelAccess,
  type DashboardApp,
  type DashboardPublisher,
  type ManualUpload,
  type Members,
  type Namespace,
  type ProofMethod,
  type PublishResponse,
  type ReleaseDetail,
  type ReleaseSummary,
  type RestorableProject,
  type RolloutRequest,
  type Stats,
  type UpdatePublisher,
  type VerificationState,
} from "@schelf/protocol"
import { request } from "@schelf/publisher"

export function dashboard(api: string, token: string) {
  const base = `${api}${API_BASE}/dev`
  const get = <T>(path: string) => request<T>(`${base}${path}`, { token })
  const send =
    (method: string) =>
    <T>(path: string, body?: unknown) =>
      request<T>(`${base}${path}`, {
        method,
        token,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
  const post = send("POST")
  const patch = send("PATCH")
  const remove = send("DELETE")
  const app = (id: string) => `/apps/${encodeURIComponent(id)}`
  const publisher = (id: string) => `/publishers/${encodeURIComponent(id)}`

  return {
    account: () => get<Account>("/account"),
    declineInvite: (id: string) => post<void>(`/invites/${id}/decline`),
    approvals: () => get<Approval[]>("/requests"),
    publisher: (id: string) => get<DashboardPublisher>(publisher(id)),
    updatePublisher: (id: string, body: UpdatePublisher) => patch<DashboardPublisher>(publisher(id), body),
    putLogo: (id: string, bytes: Uint8Array<ArrayBuffer>) =>
      request<DashboardPublisher>(`${base}${publisher(id)}/logo`, { method: "PUT", token, body: bytes }),
    members: (id: string) => get<Members>(`${publisher(id)}/members`),
    revokeInvite: (id: string, invite: string) => remove<void>(`${publisher(id)}/invites/${invite}`),
    namespaces: (owner: string) => get<Namespace[]>(`${publisher(owner)}/namespaces`),
    verifyNamespace: (owner: string, prefix: string, method: ProofMethod) =>
      post<Namespace>(`${publisher(owner)}/namespaces/${encodeURIComponent(prefix)}/verify`, { method }),
    verification: (owner: string) => get<VerificationState>(`${publisher(owner)}/verification`),
    apps: (owner: string) => get<DashboardApp[]>(`${publisher(owner)}/apps`),
    deletedApps: (owner: string) => get<RestorableProject[]>(`${publisher(owner)}/apps/deleted`),
    app: (id: string) => get<AppSettings>(app(id)),
    revokeToken: (id: string, token: string) => remove<void>(`${app(id)}/tokens/${token}`),
    checkDomain: (id: string) => post<AppSettings>(`${app(id)}/domain/check`),
    channelAccess: (id: string, channel: string) =>
      get<ChannelAccess>(`${app(id)}/channels/${channel}/access`),
    uninvite: (id: string, channel: string, invite: string) =>
      remove<ChannelAccess>(`${app(id)}/channels/${channel}/invites/${invite}`),
    revokeChannelToken: (id: string, channel: string, token: string) =>
      remove<ChannelAccess>(`${app(id)}/channels/${channel}/tokens/${token}`),
    releases: (id: string) => get<ReleaseSummary[]>(`${app(id)}/releases`),
    release: (id: string, release: string) => get<ReleaseDetail>(`${app(id)}/releases/${release}`),
    rollout: (id: string, release: string, body: RolloutRequest) =>
      post<ReleaseDetail>(`${app(id)}/releases/${release}/rollout`, body),
    promote: (id: string, release: string, channel: string) =>
      post<{ release: unknown }>(`${app(id)}/releases/${release}/promote`, { channel }),
    upload: (id: string, body: ManualUpload) => post<PublishResponse>(`${app(id)}/uploads`, body),
    stats: (id: string, days: number) => get<Stats>(`${app(id)}/stats?days=${days}`),
  }
}

export type Dashboard = ReturnType<typeof dashboard>
