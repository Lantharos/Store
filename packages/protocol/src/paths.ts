export const DOWNLOAD_ORIGIN = "https://dl.schelf.store"
export const STORE_ORIGIN = "https://schelf.store"

export const PRIVATE_PREFIX = "private/"
export const INVITED_PREFIX = "invited/"

export const paths = {
  catalog: "index/v1/catalog.json",
  app: (id: string) => `index/v1/apps/${id}.json`,
  mirror: (origin: "flathub" | "fedora") => `index/v1/mirror/${origin}.json`,
  sabine: (id: string, channel: string) => `sabine/${id}/${channel}.json`,
  sabinePart: (id: string, part: string, channel: string) => `sabine/${id}/parts/${part}/${channel}.json`,
  root: "trust/v1/root.pub",
  storeKeys: "trust/v1/store-keys.json",
  revocations: "trust/v1/revocations.json",
  artifact: (id: string, version: string, platform: string, file: string) =>
    `apps/${id}/${version}/${platform}/${file}`,
  invitedArtifact: (id: string, version: string, platform: string, file: string) =>
    `${INVITED_PREFIX}apps/${id}/${version}/${platform}/${file}`,
  invitedApp: (id: string, channel: string) => `${INVITED_PREFIX}index/v1/apps/${id}/${channel}.json`,
  invitedSabine: (id: string, channel: string) => `${INVITED_PREFIX}sabine/${id}/${channel}.json`,
  invitedSabinePart: (id: string, part: string, channel: string) =>
    `${INVITED_PREFIX}sabine/${id}/parts/${part}/${channel}.json`,
  blockmap: (artifact: string) => `${artifact}.blockmap`,
  check: (id: string, version: string, name: string) => `apps/${id}/${version}/checks/${name}.json`,
  delta: (id: string, from: string, to: string, platform: string) =>
    `apps/${id}/deltas/${from}-${to}/${platform}.zst`,
  media: (id: string, hash: string, extension: string) => `media/${id}/${hash}.${extension}`,
  publisherLogo: (id: string, hash: string, extension: string) =>
    `media/publishers/${id}/${hash}.${extension}`,
  userAvatar: (id: string, hash: string, extension: string) => `media/users/${id}/${hash}.${extension}`,
  verificationDocument: (id: string, hash: string, extension: string) =>
    `${PRIVATE_PREFIX}verification/${id}/${hash}.${extension}`,
  signature: (key: string) => `${key}.sig`,
}

export function rasterIcon(icon: string) {
  return icon.replace(/\.svg$/, ".png")
}

export function downloadUrl(key: string) {
  return `${DOWNLOAD_ORIGIN}/${key}`
}
