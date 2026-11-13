import { readFileSync } from "node:fs"
import { join } from "node:path"
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
const DESCRIPTIVE =
  /(^|\/)share\/(metainfo|appdata|applications|doc|licenses|man|icons|locale|mime)\/|(^|\/)(licen[cs]e|copying|notice|credits|authors|third[_-]?party)[^/]*$|\.(md|txt|desktop|xml|svg|png|jpe?g|webp|ico|mo|po|ttf|otf|ttc|woff2?)$/i
const MAX_PER_KIND = 200
const URL =
  /\b(?:https?|wss?|ftp):\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z0-9.-])|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(\/[^\s"'`<>()\\]*)?/g
const ADDRESS = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{2,5})?$/
const BUS_NAME = /^(?:org|com|net|io)(?:\.[A-Za-z_][A-Za-z0-9_-]{0,31}){2,7}$/
const DEVICE =
  /\/dev\/(?:bus\/usb|ttyUSB\d*|ttyACM\d*|ttyS\d*|hidraw\d*|video\d*|input\/[a-z0-9]+|uinput|kvm|k?mem|sd[a-z]\d*|nvme\d\S*)/g
const PROGRAM =
  /(?:^|[\s"'=])((?:\/usr)?\/s?bin\/[a-z0-9._+-]+|pkexec|sudo|crontab|setcap|insmod|modprobe)(?=$|[\s"';])/g
const REFERENCE_DOMAINS =
  /(^|\.)(w3\.org|xmlsoap\.org|purl\.org|adobe\.com|openxmlformats\.org|xfa\.org|aiim\.org|npes\.org|example\.(com|org|net)|foo\.bar|localhost|schemas\.[a-z.]+|abattis\.org|sil\.org|ascendercorp\.com|unicode\.org|creativecommons\.org|opensource\.org|spdx\.org|khronos\.org|freedesktop\.org|ietf\.org|rfc-editor\.org|docs\.rs|svelte\.dev|react\.dev|base-ui\.com|tailwindcss\.com)$/
const REFERENCE_SITES = /^(www\.)?(gnu\.org|fsf\.org|apache\.org|mozilla\.org|unlicense\.org|apple\.com)$/
const CODE_HOSTS = /^(www\.)?(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|sourceforge\.net)$/
const DOWNLOAD_PATH = /^\/[^?#]*\/(releases|raw|archive|download)(\/|$)/
const BARE_WWW = /^www\.[a-z0-9-]+$/
const TOP_LEVEL_DOMAINS = new Set(
  readFileSync(join(import.meta.dirname, "../../rules/tlds.txt"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.toLowerCase()),
)

const reachesHost = (host: string, path = "") =>
  TOP_LEVEL_DOMAINS.has(host.slice(host.lastIndexOf(".") + 1)) &&
  !REFERENCE_DOMAINS.test(host) &&
  !REFERENCE_SITES.test(host) &&
  !BARE_WWW.test(host) &&
  (!CODE_HOSTS.test(host) || DOWNLOAD_PATH.test(path))

const isBusName = (candidate: string) =>
  BUS_NAME.test(candidate) &&
  candidate
    .split(".")
    .every(
      (segment) =>
        segment !== "Error" &&
        !/[a-z\d][A-Z]$/.test(segment) &&
        !(segment.includes("_") && /[a-z][A-Z]/.test(segment)),
    )

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
  for (const [, host, path] of text.matchAll(URL)) {
    const name = host!.toLowerCase()
    if (/^\d/.test(name)) {
      if (isPublicAddress(name)) add(into.addresses, name)
    } else if (reachesHost(name, path)) add(into.hosts, name)
  }
  for (const [device] of text.matchAll(DEVICE)) add(into.devices, device)
  for (const [, program] of text.matchAll(PROGRAM)) add(into.programs, program!)
  for (const line of text.split("\n")) {
    const candidate = line.trim()
    if (isBusName(candidate)) add(into.busNames, candidate)
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
  const scanned = files.filter((file) => file.size <= MAX_FILE_BYTES && !DESCRIPTIVE.test(file.path))
  await mapLimit(scanned, 8, async (file) => {
    const { stdout } = await run("strings", ["-a", "-n", "6", file.absolute])
    scanText(stdout, file.path, facts)
  })
  for (const list of Object.values(facts) as Evidence[][])
    list.sort((left, right) => left.value.localeCompare(right.value))
  return facts
}
