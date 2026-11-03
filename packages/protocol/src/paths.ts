export const DOWNLOAD_ORIGIN = "https://dl.schelf.store"
export const STORE_ORIGIN = "https://schelf.store"

export const paths = {
  catalog: "index/v1/catalog.json",
  app: (id: string) => `index/v1/apps/${id}.json`,
  mirror: (origin: "flathub" | "fedora") => `index/v1/mirror/${origin}.json`,
  sabine: (id: string, channel: string) => `sabine/${id}/${channel}.json`,
  root: "trust/v1/root.pub",
  storeKeys: "trust/v1/store-keys.json",
  revocations: "trust/v1/revocations.json",
  artifact: (id: string, version: string, platform: string, file: string) =>
    `apps/${id}/${version}/${platform}/${file}`,
  check: (id: string, version: string, name: string) => `apps/${id}/${version}/checks/${name}.json`,
  delta: (id: string, from: string, to: string, platform: string) =>
    `apps/${id}/deltas/${from}-${to}/${platform}.zst`,
  media: (id: string, hash: string, extension: string) => `media/${id}/${hash}.${extension}`,
  signature: (key: string) => `${key}.sig`,
}

export function downloadUrl(key: string) {
  return `${DOWNLOAD_ORIGIN}/${key}`
}
