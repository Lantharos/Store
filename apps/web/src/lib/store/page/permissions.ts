import type { Permissions } from "@schelf/protocol"

export type PermissionIcon =
  | "full"
  | "folder"
  | "device"
  | "microphone"
  | "camera"
  | "x11"
  | "talk"
  | "network"
  | "offline"

export interface PermissionLine {
  icon: PermissionIcon
  text: string
  detail?: string
}

const FOLDERS: Record<string, string> = {
  home: "your home folder",
  "xdg-desktop": "Desktop",
  "xdg-documents": "Documents",
  "xdg-download": "Downloads",
  "xdg-music": "Music",
  "xdg-pictures": "Pictures",
  "xdg-videos": "Videos",
}

const DEVICES: Record<string, string> = {
  usb: "USB devices",
  serial: "Serial ports",
  all: "Every device you plug in",
}

const list = (items: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(items)

function folderLine(places: string[], readOnly: boolean): PermissionLine | null {
  const names = places.map((place) => FOLDERS[place.replace(/:ro$/, "")]!).filter(Boolean)
  if (!names.length) return null
  const home = names.includes("your home folder")
  const subject = home
    ? "Everything in your home folder"
    : `${list(names)} ${names.length === 1 ? "folder" : "folders"}`
  return {
    icon: "folder",
    text: readOnly ? `Read ${home ? "everything in your home folder" : `your ${subject}`}` : subject,
  }
}

export function describePermissions(permissions: Permissions | null): {
  full: boolean
  lines: PermissionLine[]
} {
  if (!permissions || permissions.unsandboxed !== null) {
    return {
      full: true,
      lines: [
        {
          icon: "full",
          text: "Full access to your computer",
          detail:
            permissions?.unsandboxed ??
            "It runs with the same rights as you, like most apps on Windows and macOS.",
        },
      ],
    }
  }
  const lines: PermissionLine[] = []
  const writable = permissions.filesystems.filter((place) => !place.endsWith(":ro"))
  const readable = permissions.filesystems.filter((place) => place.endsWith(":ro"))
  for (const line of [folderLine(writable, false), folderLine(readable, true)]) if (line) lines.push(line)
  lines.push({ icon: "folder", text: "Files you open with it" })
  for (const device of permissions.devices) lines.push({ icon: "device", text: DEVICES[device] ?? device })
  if (permissions.microphone)
    lines.push({ icon: "microphone", text: "The microphone", detail: "And the sound this computer plays." })
  if (permissions.camera) lines.push({ icon: "camera", text: "The camera" })
  if (permissions.x11)
    lines.push({
      icon: "x11",
      text: "The older way of showing windows",
      detail: "Apps that use X11 can see each other’s windows and what you type in them.",
    })
  if (permissions.talk.length) {
    lines.push({
      icon: "talk",
      text:
        permissions.talk.length === 1
          ? "Talk to one other service"
          : `Talk to ${permissions.talk.length} other services`,
      detail: permissions.talk.join(", "),
    })
  }
  lines.push(
    permissions.network
      ? { icon: "network", text: "The internet" }
      : { icon: "offline", text: "No internet access" },
  )
  return { full: false, lines }
}
