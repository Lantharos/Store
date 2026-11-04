import { parse } from "smol-toml"
import { z } from "zod"

export const EXTENSION_MANIFEST = "extension.toml"

export const EXTENSION_PERMISSIONS = [
  "wallpaper",
  "quick-settings",
  "taskbar",
  "search",
  "notifications",
  "weather",
  "location",
  "media",
  "popups",
  "typing",
  "sounds",
  "audio-levels",
  "calls",
  "locked-sounds",
  "do-not-disturb",
] as const
export const extensionPermission = z.enum(EXTENSION_PERMISSIONS, {
  error: (issue) => `${String(issue.input)} isn't a permission an extension can ask for.`,
})
export type ExtensionPermission = z.infer<typeof extensionPermission>

export const EXTENSION_PERMISSION_LABELS: Record<ExtensionPermission, string> = {
  wallpaper: "Draw over the wallpaper",
  "quick-settings": "Add tiles to quick settings",
  taskbar: "Add buttons to the taskbar",
  search: "Add results to search",
  notifications: "Send notifications",
  weather: "See the weather where you are",
  location: "See roughly where you are",
  media: "See and control what's playing",
  popups: "Show panels and small windows",
  typing: "Type into other apps",
  sounds: "Play sounds",
  "audio-levels": "Follow the beat of what's playing",
  calls: "Know when you're in a call",
  "locked-sounds": "Keep playing sounds while the screen is locked",
  "do-not-disturb": "Hold back notifications for a while",
}
export const EXTENSION_HELPER_LABEL = "Runs its own program"
export const extensionNetworkLabel = (hosts: string[]) =>
  `Connect to ${new Intl.ListFormat("en", { type: "conjunction" }).format(hosts)}`

const HOST =
  /^(localhost|127\.0\.0\.1|[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)(:\d{1,5})?$/
const extensionHost = z.string().regex(HOST, "A host is a name such as api.example.com")
export const EXTENSION_HELPER_PLATFORMS = ["luft-x86_64", "luft-aarch64"] as const

/** What an extension's manifest asks for: its permissions, whether it ships a native helper, and the hosts it connects to. */
export const extensionAccess = z.object({
  permissions: z.array(extensionPermission),
  helper: z.boolean(),
  network: z.array(extensionHost).optional(),
})
export type ExtensionAccess = z.infer<typeof extensionAccess>

const manifestAccess = z.object({
  permissions: z.array(extensionPermission).default([]),
  helper: z.object({}).loose().optional(),
  network: z.object({ hosts: z.array(extensionHost).min(1) }).optional(),
})

export function readExtensionAccess(manifest: string): ExtensionAccess {
  const read = manifestAccess.parse(parse(manifest))
  return {
    permissions: [...new Set(read.permissions)],
    helper: read.helper !== undefined,
    ...(read.network && { network: [...new Set(read.network.hosts)] }),
  }
}

export function extensionLabels(access: ExtensionAccess) {
  return [
    ...access.permissions.map((permission) => EXTENSION_PERMISSION_LABELS[permission]),
    ...(access.network?.length ? [extensionNetworkLabel(access.network)] : []),
    ...(access.helper ? [EXTENSION_HELPER_LABEL] : []),
  ]
}

export function extensionWidens(before: ExtensionAccess | null, after: ExtensionAccess) {
  if (!before) return false
  return (
    (after.helper && !before.helper) ||
    after.permissions.some((name) => !before.permissions.includes(name)) ||
    (after.network ?? []).some((host) => !before.network?.includes(host))
  )
}
