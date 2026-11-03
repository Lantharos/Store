import { readComponent } from "./component.ts"
import { elements, parseXml } from "./xml.ts"

export type { Component, Icon, Localized, Release, Screenshot } from "./component.ts"

export function parseMetainfo(text: string) {
  const component = elements(parseXml(text), "component")[0]
  if (!component) throw new Error("no <component> in the AppStream file")
  return readComponent(component)
}

export function parseCollection(text: string) {
  const collection = elements(parseXml(text), "components")[0]
  if (!collection) throw new Error("no <components> in the AppStream collection")
  const mediaBase = collection.attributes.media_baseurl
  return {
    origin: collection.attributes.origin,
    mediaBase,
    components: elements(collection, "component").map((component) => readComponent(component, mediaBase)),
  }
}
