import type { Kind } from "@schelf/protocol"

export interface ProjectTab {
  label: string
  path: string
}

export function projectTabs(kind: Kind): ProjectTab[] {
  return [
    { label: "Overview", path: "" },
    ...(kind === "extension"
      ? []
      : [
          { label: "Share", path: "/share" },
          { label: "Updates", path: "/updates" },
        ]),
    { label: "Listing", path: "/listing" },
    { label: "Stats", path: "/stats" },
    { label: "Settings", path: "/settings" },
  ]
}
