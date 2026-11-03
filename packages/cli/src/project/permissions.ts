import type { Permissions } from "@schelf/protocol"

const FOLDERS: Record<string, string> = {
  home: "your home folder",
  "xdg-desktop": "Desktop",
  "xdg-documents": "Documents",
  "xdg-download": "Downloads",
  "xdg-music": "Music",
  "xdg-pictures": "Pictures",
  "xdg-videos": "Videos",
}

const DEVICES: Record<string, string> = { usb: "USB devices", serial: "serial ports", all: "every device" }

export function describePermissions(permissions: Permissions | null): string[] {
  if (!permissions) return ["Full access, since nothing is declared"]
  if (permissions.unsandboxed !== null) return [`Full access: ${permissions.unsandboxed}`]
  const lines: string[] = [permissions.network ? "Goes online" : "Stays offline"]
  for (const place of permissions.filesystems) {
    const readOnly = place.endsWith(":ro")
    const folder = FOLDERS[place.replace(/:ro$/, "")]!
    lines.push(`${readOnly ? "Reads" : "Reads and changes"} ${folder}`)
  }
  for (const device of permissions.devices) lines.push(`Uses ${DEVICES[device]}`)
  for (const name of permissions.talk) lines.push(`Talks to ${name}`)
  return lines
}
