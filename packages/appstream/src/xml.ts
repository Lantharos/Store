import { XMLParser } from "fast-xml-parser"

export interface XmlNode {
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  text: string
}

type Ordered = Record<string, unknown> & { ":@"?: Record<string, string> }

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  processEntities: true,
  parseTagValue: false,
})

function toNode(entry: Ordered): XmlNode | undefined {
  const name = Object.keys(entry).find((key) => key !== ":@")
  if (!name) return undefined
  const content = entry[name]
  if (name === "#text") return { name, attributes: {}, children: [], text: String(content) }
  const children = (content as Ordered[]).map(toNode).filter((node) => node !== undefined)
  return {
    name,
    attributes: entry[":@"] ?? {},
    children,
    text: children.map((child) => child.text).join(""),
  }
}

export function parseXml(text: string): XmlNode {
  const children = (parser.parse(text) as Ordered[]).map(toNode).filter((node) => node !== undefined)
  return { name: "#document", attributes: {}, children, text: "" }
}

export const elements = (node: XmlNode | undefined, name: string) =>
  node?.children.filter((child) => child.name === name) ?? []

export const element = (node: XmlNode | undefined, name: string) =>
  node?.children.find((child) => child.name === name)

export const textOf = (node: XmlNode | undefined) => node?.text.replace(/\s+/g, " ").trim() ?? ""
