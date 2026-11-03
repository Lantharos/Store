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
}
export const EXTENSION_HELPER_LABEL = "Runs its own program"

/** What an extension's manifest asks for: its permissions, and whether it ships a native helper. */
export const extensionAccess = z.object({
  permissions: z.array(extensionPermission),
  helper: z.boolean(),
})
export type ExtensionAccess = z.infer<typeof extensionAccess>

const manifestAccess = z.object({
  permissions: z.array(extensionPermission).default([]),
  helper: z.object({}).loose().optional(),
})

export function readExtensionAccess(manifest: string): ExtensionAccess {
  const read = manifestAccess.parse(parse(manifest))
  return { permissions: [...new Set(read.permissions)], helper: read.helper !== undefined }
}

export function extensionLabels(access: ExtensionAccess) {
  return [
    ...access.permissions.map((permission) => EXTENSION_PERMISSION_LABELS[permission]),
    ...(access.helper ? [EXTENSION_HELPER_LABEL] : []),
  ]
}

export function extensionWidens(before: ExtensionAccess | null, after: ExtensionAccess) {
  if (!before) return false
  return (
    (after.helper && !before.helper) || after.permissions.some((name) => !before.permissions.includes(name))
  )
}
