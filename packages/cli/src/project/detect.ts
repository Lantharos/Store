import { join } from "node:path"
import { type Component, parseMetainfo } from "@schelf/appstream"
import type { Format, Kind } from "@schelf/protocol"
import { type ExtensionManifest, readExtension } from "./extension.ts"
import { findFiles, readOptional } from "./files.ts"
import { githubRepository, type Repository } from "./git.ts"
import { readSabine, type SabineApp } from "./sabine.ts"

export interface Project {
  root: string
  kind: Kind
  format: Format
  id?: string
  name?: string
  summary?: string
  version?: string
  licence?: string
  sabine?: SabineApp
  extension?: ExtensionManifest
  appstream?: { path: string; component: Component }
  appImageEvidence?: string
  repository?: Repository
  found: string[]
}

const METAINFO = /\.(metainfo|appdata)\.xml$/
const APPIMAGE_CONFIGS = [
  "AppImageBuilder.yml",
  "appimage-builder.yml",
  "electron-builder.yml",
  "electron-builder.json",
]
const APPIMAGE_TOOLS = /appimagetool|linuxdeploy|appimage-builder|\.AppImage\b|"AppImage"|\bappimage\b/i

async function findMetainfo(root: string, id?: string) {
  const paths = await findFiles(root, (name) => METAINFO.test(name))
  const parsed = await Promise.all(
    paths.map(async (path) => {
      try {
        return { path, component: parseMetainfo((await readOptional(join(root, path)))!) }
      } catch {
        return undefined
      }
    }),
  )
  const components = parsed.filter((entry) => entry !== undefined)
  return (
    components.find((entry) => id && entry.component.id.replace(/\.desktop$/, "") === id) ?? components[0]
  )
}

async function findAppImageBuild(root: string) {
  for (const config of APPIMAGE_CONFIGS) {
    const text = await readOptional(join(root, config))
    if (text && (config.startsWith("AppImage") || config.startsWith("appimage") || APPIMAGE_TOOLS.test(text)))
      return config
  }
  const workflows = await findFiles(join(root, ".github", "workflows"), (name) => /\.ya?ml$/.test(name))
  for (const workflow of workflows) {
    const text = await readOptional(join(root, ".github", "workflows", workflow))
    if (text && APPIMAGE_TOOLS.test(text)) return `.github/workflows/${workflow}`
  }
  const tauri = await readOptional(join(root, "src-tauri", "tauri.conf.json"))
  if (tauri && /appimage/i.test(tauri)) return "src-tauri/tauri.conf.json"
  return undefined
}

async function findLicence(root: string, component?: Component) {
  if (component?.projectLicense) return component.projectLicense
  const packageJson = await readOptional(join(root, "package.json"))
  if (packageJson) {
    const licence = (JSON.parse(packageJson) as { license?: string }).license
    if (licence) return licence
  }
  const cargo = await readOptional(join(root, "Cargo.toml"))
  return cargo ? /^license\s*=\s*"([^"]+)"/m.exec(cargo)?.[1] : undefined
}

export async function detectProject(root: string): Promise<Project> {
  const [sabineText, extensionText, repository] = await Promise.all([
    readOptional(join(root, "Sabine.toml")),
    readOptional(join(root, "extension.toml")),
    githubRepository(root),
  ])
  const found: string[] = []
  const sabine = sabineText ? readSabine(sabineText) : undefined
  if (sabine) found.push("Sabine.toml")
  const extension = extensionText ? readExtension(extensionText) : undefined
  if (extension) found.push("extension.toml")
  const appstream = await findMetainfo(root, sabine?.id ?? extension?.id)
  if (appstream) found.push(appstream.path)
  const appImageEvidence = sabine || extension ? undefined : await findAppImageBuild(root)
  if (appImageEvidence) found.push(appImageEvidence)

  const kind: Kind = extension ? "extension" : "app"
  const format: Format = extension ? "luft-extension" : sabine ? "sabine" : "appimage"
  const component = appstream?.component
  return {
    root,
    kind,
    format,
    id: extension?.id ?? sabine?.id ?? component?.id.replace(/\.desktop$/, ""),
    name: extension?.name ?? sabine?.name ?? component?.name.en,
    summary: extension?.summary ?? component?.summary.en,
    version: extension?.version ?? sabine?.version ?? component?.releases[0]?.version,
    licence: await findLicence(root, component),
    sabine,
    extension,
    appstream,
    appImageEvidence,
    repository,
    found,
  }
}
