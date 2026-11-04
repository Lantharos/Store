import type { DashboardApp } from "@schelf/protocol"

const GROUPS = [
  { kind: "app", label: "Apps" },
  { kind: "extension", label: "Extensions" },
] as const

export const projectGroups = (apps: DashboardApp[]) =>
  GROUPS.map((group) => ({ ...group, apps: apps.filter((app) => app.kind === group.kind) })).filter(
    (group) => group.apps.length,
  )
