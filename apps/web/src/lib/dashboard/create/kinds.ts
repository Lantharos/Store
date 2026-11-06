import AppWindow from "@lucide/svelte/icons/app-window"
import Atom from "@lucide/svelte/icons/atom"
import Feather from "@lucide/svelte/icons/feather"
import FileBox from "@lucide/svelte/icons/file-box"
import Package from "@lucide/svelte/icons/package"
import Puzzle from "@lucide/svelte/icons/puzzle"
import type { Format, Kind, Updater } from "@schelf/protocol"
import type { Component } from "svelte"

export type Step = "kind" | "name" | "id" | "visibility" | "source" | "publishing" | "finish"

export const STEP_TITLES: Record<Step, string> = {
  kind: "What it is",
  name: "Name",
  id: "App id",
  visibility: "Who finds it",
  source: "Source",
  publishing: "Releases",
  finish: "First release",
}

export type ProjectKind = "sabine" | "extension" | "electron" | "tauri" | "appimage" | "files"

interface KindInfo {
  title: string
  text: string
  icon: Component<{ class?: string }>
  steps: Step[]
  store?: { kind: Kind; format: Exclude<Format, "files"> }
  updater?: Exclude<Updater, "sabine">
  uploads: boolean
}

const STORE_STEPS: Step[] = ["kind", "name", "id", "visibility", "source", "publishing", "finish"]
const HOSTED_STEPS: Step[] = ["kind", "name", "id", "source", "publishing", "finish"]

export const KINDS: Record<ProjectKind, KindInfo> = {
  sabine: {
    title: "Luft or Sabine app",
    text: "One app for Luft, Linux, Windows and macOS, installed and kept up to date by Schelf.",
    icon: AppWindow,
    steps: STORE_STEPS,
    store: { kind: "app", format: "sabine" },
    uploads: true,
  },
  extension: {
    title: "Luft extension",
    text: "Adds something to Luft's desktop, and installs from Schelf in a click.",
    icon: Puzzle,
    steps: ["kind", "name", "id", "source", "publishing", "finish"],
    store: { kind: "extension", format: "luft-extension" },
    uploads: false,
  },
  electron: {
    title: "Electron app",
    text: "Download links for every system, and updates through electron-updater.",
    icon: Atom,
    steps: HOSTED_STEPS,
    updater: "electron",
    uploads: true,
  },
  tauri: {
    title: "Tauri app",
    text: "Download links for every system, and signed updates through Tauri's updater.",
    icon: Feather,
    steps: HOSTED_STEPS,
    updater: "tauri",
    uploads: true,
  },
  appimage: {
    title: "AppImage",
    text: "One file for any Linux, which Luft runs in its sandbox.",
    icon: Package,
    steps: STORE_STEPS,
    store: { kind: "app", format: "appimage" },
    uploads: true,
  },
  files: {
    title: "Something else",
    text: "Installers, programs, APKs or archives, with download links that never go stale.",
    icon: FileBox,
    steps: HOSTED_STEPS,
    uploads: true,
  },
}
