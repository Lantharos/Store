import {
  type AppPage,
  type Catalog,
  type FeaturedResponse,
  type MirrorEntry,
  type PublisherPage,
  paths,
  platformParam,
  type SearchResponse,
  type System,
} from "@schelf/protocol"
import { file, find, get } from "./server.ts"

function query(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const text = search.toString()
  return text ? `?${text}` : ""
}

export const featured = (system: System) =>
  get<FeaturedResponse>(`/featured${query({ platform: platformParam(system) })}`)

export const search = (q: string, system: System, kind?: "app" | "extension") =>
  get<SearchResponse>(`/search${query({ q, platform: platformParam(system), kind })}`)

export const appPage = (id: string) =>
  get<AppPage>(`/apps/${encodeURIComponent(id)}`, "There's no app here. It may have moved or been removed.")

export const findAppPage = (id: string) => find<AppPage>(`/apps/${encodeURIComponent(id)}`)

export const findMirrorApp = (id: string) => find<MirrorEntry>(`/mirror/${encodeURIComponent(id)}`)

export const publisher = (slug: string) =>
  get<PublisherPage>(`/publishers/${encodeURIComponent(slug)}`, "There's no publisher by that name.")

export const catalog = () => file<Catalog>(paths.catalog)
