import type { Updater } from "@schelf/protocol"

export const FRAMEWORKS: { updater: Updater; title: string; text: string }[] = [
  { updater: "sabine", title: "Sabine", text: "Sabine's own updates, signed by Schelf." },
  { updater: "electron", title: "electron-updater", text: "For Electron apps, from latest.yml." },
  { updater: "tauri", title: "Tauri's updater", text: "For Tauri apps, from a signed JSON feed." },
]

export const frameworkName = (updater: Updater | null) =>
  updater ? FRAMEWORKS.find((framework) => framework.updater === updater)!.title : "Downloads only"

export function bridgeAdvice(from: Updater) {
  if (from === "electron")
    return "On macOS, electron-updater swaps the app in place, so the bridge can be the new app zipped, signed with the same Apple certificate. On Windows, ship a small Electron build that runs the new installer and then uninstalls itself."
  if (from === "tauri")
    return "On macOS and in AppImages, Tauri's updater swaps the app in place, so the bridge can be the new app in Tauri's bundle, signed with your updater key. On Windows, ship a small Tauri build that runs the new installer and then uninstalls itself."
  return "Sabine updates only Sabine apps, so the bridge is a last Sabine build that installs the new app and then removes itself."
}
