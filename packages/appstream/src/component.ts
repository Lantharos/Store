import { element, elements, textOf, type XmlNode } from "./xml.ts"

export type Localized = Record<string, string>

export interface Screenshot {
  url: string
  caption?: string
  width?: number
  height?: number
  primary: boolean
}

export interface Icon {
  kind: string
  value: string
  width?: number
}

export interface Release {
  version: string
  date?: string
}

export interface Component {
  id: string
  type: string
  name: Localized
  summary: Localized
  description: string
  developer?: string
  projectLicense?: string
  urls: Record<string, string>
  categories: string[]
  keywords: string[]
  screenshots: Screenshot[]
  icons: Icon[]
  releases: Release[]
  contentRating?: { type: string; attributes: Record<string, string> }
  launchable?: string
  packageName?: string
  bundles: { type: string; value: string }[]
  replaces: string[]
}

const language = (node: XmlNode) => node.attributes["xml:lang"]

function localized(nodes: XmlNode[]): Localized {
  const values: Localized = {}
  for (const node of nodes) {
    const text = textOf(node)
    if (text) values[language(node) ?? "en"] = text
  }
  return values
}

function describe(node: XmlNode | undefined): string {
  if (!node) return ""
  const blocks: string[] = []
  for (const child of node.children) {
    if (language(child)) continue
    if (child.name === "p") blocks.push(textOf(child))
    if (child.name === "ul" || child.name === "ol") {
      const items = elements(child, "li").filter((item) => !language(item))
      blocks.push(items.map((item) => `• ${textOf(item)}`).join("\n"))
    }
  }
  return blocks.filter(Boolean).join("\n\n")
}

const number = (value: string | undefined) => (value ? Number.parseInt(value, 10) : undefined)

function screenshot(node: XmlNode, mediaBase: string | undefined): Screenshot | undefined {
  const images = elements(node, "image").filter((image) => !language(image))
  const image = images.find((candidate) => candidate.attributes.type === "source") ?? images[0]
  if (!image) return undefined
  const path = textOf(image)
  const caption = textOf(elements(node, "caption").find((candidate) => !language(candidate)))
  return {
    url: mediaBase && !/^https?:/.test(path) ? `${mediaBase.replace(/\/$/, "")}/${path}` : path,
    caption: caption || undefined,
    width: number(image.attributes.width),
    height: number(image.attributes.height),
    primary: node.attributes.type === "default",
  }
}

function releaseDate(node: XmlNode): string | undefined {
  const { date, timestamp } = node.attributes
  if (date) return date
  return timestamp ? new Date(Number(timestamp) * 1000).toISOString().slice(0, 10) : undefined
}

export function readComponent(node: XmlNode, mediaBase?: string): Component {
  const developer = element(node, "developer")
  const rating = element(node, "content_rating")
  return {
    id: textOf(element(node, "id")),
    type: node.attributes.type ?? "generic",
    name: localized(elements(node, "name")),
    summary: localized(elements(node, "summary")),
    description: describe(element(node, "description")),
    developer: textOf(developer ? element(developer, "name") : element(node, "developer_name")) || undefined,
    projectLicense: textOf(element(node, "project_license")) || undefined,
    urls: Object.fromEntries(
      elements(node, "url").map((url) => [url.attributes.type ?? "homepage", textOf(url)]),
    ),
    categories: elements(element(node, "categories"), "category").map(textOf),
    keywords: elements(element(node, "keywords"), "keyword")
      .filter((keyword) => !language(keyword))
      .map(textOf),
    screenshots: elements(element(node, "screenshots"), "screenshot")
      .map((entry) => screenshot(entry, mediaBase))
      .filter((entry) => entry !== undefined),
    icons: elements(node, "icon").map((icon) => ({
      kind: icon.attributes.type ?? "stock",
      value: textOf(icon),
      width: number(icon.attributes.width),
    })),
    releases: elements(element(node, "releases"), "release").map((release) => ({
      version: release.attributes.version ?? "",
      date: releaseDate(release),
    })),
    contentRating: rating && {
      type: rating.attributes.type ?? "oars-1.1",
      attributes: Object.fromEntries(
        elements(rating, "content_attribute").map((entry) => [entry.attributes.id ?? "", textOf(entry)]),
      ),
    },
    launchable: textOf(element(node, "launchable")) || undefined,
    packageName: textOf(element(node, "pkgname")) || undefined,
    bundles: elements(node, "bundle").map((bundle) => ({
      type: bundle.attributes.type ?? "",
      value: textOf(bundle),
    })),
    replaces: elements(element(node, "replaces"), "id").map(textOf),
  }
}
