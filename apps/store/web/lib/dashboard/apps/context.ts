import type { AppSettings } from "@schelf/protocol"
import { createContext } from "svelte"
import type { Resource } from "../api/resource.svelte.ts"

export const [appSettings, provideAppSettings] = createContext<() => Resource<AppSettings>>()
