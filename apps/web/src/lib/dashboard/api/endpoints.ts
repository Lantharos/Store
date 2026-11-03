const app = (id: string) => `/apps/${encodeURIComponent(id)}`

export const endpoints = {
  account: "/account",
  apps: "/apps",
  namespaces: "/namespaces",
  namespace: (prefix: string) => `/namespaces/${encodeURIComponent(prefix)}`,
  verifyNamespace: (prefix: string) => `/namespaces/${encodeURIComponent(prefix)}/verify`,
  app,
  listing: (id: string, locale: string) => `${app(id)}/listing/${locale}`,
  meta: (id: string) => `${app(id)}/meta`,
  icon: (id: string) => `${app(id)}/icon`,
  screenshots: (id: string) => `${app(id)}/screenshots`,
  screenshot: (id: string, shot: string) => `${app(id)}/screenshots/${shot}`,
  screenshotOrder: (id: string) => `${app(id)}/screenshots/order`,
  publishers: (id: string) => `${app(id)}/publishers`,
  publisher: (id: string, publisher: string) => `${app(id)}/publishers/${publisher}`,
  tokens: (id: string) => `${app(id)}/tokens`,
  token: (id: string, token: string) => `${app(id)}/tokens/${token}`,
  releases: (id: string) => `${app(id)}/releases`,
  release: (id: string, release: string) => `${app(id)}/releases/${encodeURIComponent(release)}`,
  rollout: (id: string, release: string) => `${app(id)}/releases/${encodeURIComponent(release)}/rollout`,
  stats: (id: string, days: number) => `${app(id)}/stats?days=${days}`,
}
