import { mapLimit } from "@schelf/publisher"
import { run } from "../run.ts"
import type { TreeFile } from "./tree.ts"

export interface Evidence {
  value: string
  file: string
}

export interface StringFacts {
  hosts: Evidence[]
  addresses: Evidence[]
  busNames: Evidence[]
  devices: Evidence[]
  programs: Evidence[]
}

const MAX_FILE_BYTES = 300 * 1024 * 1024
const MAX_PER_KIND = 200
const URL = /\b(?:https?|wss?|ftp):\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?/g
const ADDRESS = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{2,5})?$/
const BUS_NAME = /^(?:org|com|net|io)\.[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){1,6}$/
const DEVICE =
  /\/dev\/(?:bus\/usb|ttyUSB\d*|ttyACM\d*|ttyS\d*|hidraw\d*|video\d*|input\/[a-z0-9]+|uinput|kvm|k?mem|sd[a-z]\d*|nvme\d\S*)/g
const PROGRAM =
  /(?:^|[\s"'=])((?:\/usr)?\/s?bin\/[a-z0-9._+-]+|pkexec|sudo|crontab|setcap|insmod|modprobe)(?=$|[\s"';])/g
const IGNORED_HOSTS =
  /(^|\.)(w3\.org|xmlsoap\.org|purl\.org|adobe\.com|example\.(com|org|net)|localhost|schemas\.[a-z.]+|apache\.org\/xml|openxmlformats\.org)$/

const isPublicAddress = (address: string) => {
  const octets = address.split(".").map(Number)
  if (octets.some((octet) => octet > 255)) return false
  const [first, second] = octets as [number, number]
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second < 32) ||
    (first === 192 && second === 168)
  )
}

export function scanText(text: string, file: string, into: StringFacts) {
  const add = (list: Evidence[], value: string) => {
    if (list.length < MAX_PER_KIND && !list.some((entry) => entry.value === value)) list.push({ value, file })
  }
  for (const [, host] of text.matchAll(URL)) {
    const name = host!.toLowerCase()
    if (/^\d/.test(name)) {
      if (isPublicAddress(name)) add(into.addresses, name)
    } else if (!IGNORED_HOSTS.test(name)) add(into.hosts, name)
  }
  for (const [device] of text.matchAll(DEVICE)) add(into.devices, device)
  for (const [, program] of text.matchAll(PROGRAM)) add(into.programs, program!)
  for (const line of text.split("\n")) {
    const candidate = line.trim()
    if (BUS_NAME.test(candidate)) add(into.busNames, candidate)
    const address = ADDRESS.exec(candidate)?.[1]
    if (address && isPublicAddress(address)) add(into.addresses, address)
  }
}

export const emptyFacts = (): StringFacts => ({
  hosts: [],
  addresses: [],
  busNames: [],
  devices: [],
  programs: [],
})

export async function scanStrings(files: TreeFile[]) {
  const facts = emptyFacts()
  const scanned = files.filter((file) => file.size <= MAX_FILE_BYTES)
  await mapLimit(scanned, 8, async (file) => {
    const { stdout } = await run("strings", ["-a", "-n", "6", file.absolute])
    scanText(stdout, file.path, facts)
  })
  for (const list of Object.values(facts) as Evidence[][]) list.sort((left, right) => left.value.localeCompare(right.value))
  return facts
}
