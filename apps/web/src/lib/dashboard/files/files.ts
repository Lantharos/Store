import type { AppSettings } from "@schelf/protocol"

export const listingFile = (settings: AppSettings) => settings.config.listing_toml
export const schelfFile = (settings: AppSettings) => settings.config.schelf_toml

export const setIn = (file: string, key: string) => `${file} · ${key}`
