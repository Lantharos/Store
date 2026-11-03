import type { Permissions } from "@schelf/protocol"
import type { Evidence, StringFacts } from "./strings.ts"
import type { TreeFile } from "./tree.ts"

export interface PermissionRow {
  permission: string
  declared: boolean
  evidence: string
}

interface Detection {
  libraries: { file: string; libraries: string[] }[]
  strings: StringFacts
  files: TreeFile[]
}

const NETWORK_LIBRARIES = /^(libcurl|libsoup|ws2_32\.dll|winhttp\.dll|wininet\.dll|CFNetwork)/i
const USB_LIBRARIES = /^(libusb|libhidapi|hid\.dll|winusb\.dll)/i
const ALWAYS_REACHABLE =
  /^org\.freedesktop\.(portal\.|Notifications$|secrets$|DBus$)|^org\.kde\.StatusNotifier/
const PRIVILEGED_PROGRAMS = new Set(["pkexec", "sudo", "insmod", "modprobe", "setcap"])
const PRIVILEGED_DEVICES = /^\/dev\/(k?mem|kvm|uinput|sd[a-z]|nvme)/

const describe = (evidence: Evidence) => `${evidence.value} in ${evidence.file}`

function libraryEvidence(detection: Detection, pattern: RegExp) {
  for (const { file, libraries } of detection.libraries) {
    const library = libraries.find((name) => pattern.test(name))
    if (library) return `links ${library} (${file})`
  }
  return undefined
}

const covers = (granted: string[], name: string) =>
  granted.some((held) => held === name || (held.endsWith(".*") && name.startsWith(held.slice(0, -1))))

export function comparePermissions(declared: Permissions | null, detection: Detection): PermissionRow[] {
  const granted = (check: (permissions: Permissions) => boolean) =>
    declared === null || declared.unsandboxed !== null || check(declared)
  const rows: PermissionRow[] = []
  const { strings } = detection

  const network = strings.hosts[0] ?? strings.addresses[0]
  const networkEvidence = network ? describe(network) : libraryEvidence(detection, NETWORK_LIBRARIES)
  if (networkEvidence)
    rows.push({ permission: "network", declared: granted((held) => held.network), evidence: networkEvidence })

  const usb =
    libraryEvidence(detection, USB_LIBRARIES) ??
    strings.devices.filter((device) => /usb|hidraw/.test(device.value)).map(describe)[0]
  const hasDevice = (name: string) =>
    granted((held) => held.devices.some((device) => device === name || device === "all"))
  if (usb) rows.push({ permission: "devices: usb", declared: hasDevice("usb"), evidence: usb })
  const serial = strings.devices.find((device) => /tty(USB|ACM|S)/.test(device.value))
  if (serial)
    rows.push({
      permission: "devices: serial",
      declared: hasDevice("serial"),
      evidence: describe(serial),
    })

  for (const name of strings.busNames.filter((entry) => !ALWAYS_REACHABLE.test(entry.value)))
    rows.push({
      permission: `talk: ${name.value}`,
      declared: granted((held) => covers(held.talk, name.value)),
      evidence: describe(name),
    })

  const privileged = [
    ...detection.files.filter((file) => file.setuid).map((file) => `setuid or setgid bit on ${file.path}`),
    ...detection.files
      .filter((file) => file.path.endsWith(".ko"))
      .map((file) => `kernel module ${file.path}`),
    ...strings.programs.filter((entry) => PRIVILEGED_PROGRAMS.has(entry.value)).map(describe),
    ...strings.devices.filter((entry) => PRIVILEGED_DEVICES.test(entry.value)).map(describe),
  ]
  for (const evidence of privileged)
    rows.push({ permission: "full access", declared: granted(() => false), evidence })

  return rows.sort((left, right) => Number(left.declared) - Number(right.declared))
}
