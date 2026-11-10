import { parse } from "smol-toml"
import { z } from "zod"
import type { Access } from "./platforms.ts"

export const FILESYSTEMS = [
  "home",
  "xdg-desktop",
  "xdg-documents",
  "xdg-download",
  "xdg-music",
  "xdg-pictures",
  "xdg-videos",
] as const
export const DEVICES = ["usb", "serial", "all"] as const
const SWITCHES = ["x11", "microphone", "camera"] as const
const READ_ONLY = ":ro"
const REFUSED_NAMES = [
  "org.freedesktop.impl.portal",
  "org.freedesktop.portal.Flatpak",
  "org.freedesktop.Flatpak",
  "org.freedesktop.systemd1",
  "org.freedesktop.DBus",
]

export function callable(name: string) {
  const bare = name.endsWith(".*") ? name.slice(0, -2) : name
  const elements = bare.split(".")
  const valid =
    elements.length >= 2 && elements.every((element) => /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(element))
  return (
    valid &&
    !REFUSED_NAMES.some(
      (refused) => bare === refused || bare.startsWith(`${refused}.`) || refused.startsWith(`${bare}.`),
    )
  )
}

const folder = z
  .string()
  .refine((place) => (FILESYSTEMS as readonly string[]).includes(place.replace(/:ro$/, "")), {
    error: (issue) => `${String(issue.input)} isn't a folder an app can ask for.`,
  })
const device = z.enum(DEVICES, {
  error: (issue) => `${String(issue.input)} isn't a device an app can ask for.`,
})
const busName = z.string().refine(callable, {
  error: (issue) => `${String(issue.input)} isn't a name an app can be given.`,
})

export const sandboxTable = z
  .strictObject({
    network: z.boolean().optional(),
    filesystems: z.array(folder).default([]),
    devices: z.array(device).default([]),
    talk: z.array(busName).default([]),
    x11: z.boolean().default(false),
    microphone: z.boolean().default(false),
    camera: z.boolean().default(false),
    unsandboxed: z.boolean().default(false),
    reason: z.string().optional(),
  })
  .superRefine((table, context) => {
    const reason = table.reason?.trim()
    if (table.unsandboxed && (!reason || reason.includes("\n")))
      context.addIssue({ code: "custom", message: "An app that asks to run unsandboxed has to say why." })
    if (!table.unsandboxed && table.reason !== undefined)
      context.addIssue({ code: "custom", message: "A reason only goes with unsandboxed = true." })
  })

export const permissions = z.object({
  network: z.boolean(),
  filesystems: z.array(z.string()),
  devices: z.array(z.enum(DEVICES)),
  talk: z.array(z.string()),
  x11: z.boolean().default(false),
  microphone: z.boolean().default(false),
  camera: z.boolean().default(false),
  unsandboxed: z.string().nullable(),
})
export type Permissions = z.infer<typeof permissions>

export const SANDBOXED_DEFAULT: Permissions = {
  network: true,
  filesystems: [],
  devices: [],
  talk: [],
  x11: false,
  microphone: false,
  camera: false,
  unsandboxed: null,
}

export function readPermissions(toml: string): Permissions {
  const document = z.object({ sandbox: sandboxTable.optional() }).parse(parse(toml))
  const table = document.sandbox
  if (!table) return SANDBOXED_DEFAULT
  if (table.unsandboxed) return { ...SANDBOXED_DEFAULT, unsandboxed: table.reason!.trim() }
  return {
    network: table.network ?? true,
    filesystems: table.filesystems,
    devices: table.devices,
    talk: table.talk,
    x11: table.x11,
    microphone: table.microphone,
    camera: table.camera,
    unsandboxed: null,
  }
}

export function accessOf(declared: Permissions | null): Access {
  return !declared || declared.unsandboxed !== null ? "full" : "limited"
}

function folderGrants(places: string[]) {
  const grants = new Map<string, boolean>()
  for (const place of places) {
    const name = place.endsWith(READ_ONLY) ? place.slice(0, -READ_ONLY.length) : place
    grants.set(name, grants.get(name) === true || !place.endsWith(READ_ONLY))
  }
  return grants
}

function busCovers(granted: string[], name: string) {
  return granted.some((held) => held === name || (held.endsWith(".*") && name.startsWith(held.slice(0, -1))))
}

export function widens(before: Permissions | null, after: Permissions | null) {
  if (!before || before.unsandboxed !== null) return false
  if (!after || after.unsandboxed !== null) return true
  if (after.network && !before.network) return true
  if (SWITCHES.some((name) => after[name] && !before[name])) return true
  const had = folderGrants(before.filesystems)
  for (const [name, writable] of folderGrants(after.filesystems)) {
    if (had.get("home") === true) continue
    if (!had.has(name) && !(had.has("home") && !writable)) return true
    if (writable && had.get(name) === false) return true
  }
  if (!before.devices.includes("all") && after.devices.some((name) => !before.devices.includes(name)))
    return true
  return after.talk.some((name) => !busCovers(before.talk, name))
}
