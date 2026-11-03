import type { Updater } from "@schelf/protocol"
import type { Language } from "../../code/highlight.ts"

export const FRAMEWORKS: { updater: Updater; title: string; text: string }[] = [
  { updater: "sabine", title: "Sabine", text: "Sabine's own updates, signed by Schelf." },
  { updater: "electron", title: "electron-updater", text: "For Electron apps, from latest.yml." },
  { updater: "tauri", title: "Tauri's updater", text: "For Tauri apps, from a signed JSON feed." },
]

export const frameworkName = (updater: Updater | null) =>
  updater ? FRAMEWORKS.find((framework) => framework.updater === updater)!.title : "Downloads only"

export function feedSetup(updater: Updater, feed: string): { file: string; lang: Language; code: string } {
  if (updater === "sabine")
    return { file: "Sabine.toml", lang: "toml", code: '[updates]\nprovider = "schelf"' }
  if (updater === "electron")
    return {
      file: "electron-builder.yml",
      lang: "yaml",
      code: `publish:\n  provider: generic\n  url: ${feed}`,
    }
  return {
    file: "tauri.conf.json",
    lang: "json",
    code: `"plugins": {\n  "updater": {\n    "endpoints": ["${feed}"],\n    "pubkey": "your updater public key"\n  }\n}`,
  }
}

export function bridgeAdvice(from: Updater) {
  if (from === "electron")
    return "On macOS, electron-updater swaps the app in place, so the bridge can be the new app zipped, signed with the same Apple certificate. On Windows, ship a small Electron build that runs the new installer and then uninstalls itself."
  if (from === "tauri")
    return "On macOS and in AppImages, Tauri's updater swaps the app in place, so the bridge can be the new app in Tauri's bundle, signed with your updater key. On Windows, ship a small Tauri build that runs the new installer and then uninstalls itself."
  return "Sabine updates only Sabine apps, so the bridge is a last Sabine build that installs the new app and then removes itself."
}
