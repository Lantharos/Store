import { type DashboardApp, PROJECT_GROUPS } from "@schelf/protocol"

export const projectGroups = (apps: DashboardApp[]) =>
  PROJECT_GROUPS.map((entry) => ({ ...entry, apps: apps.filter((app) => app.group === entry.group) })).filter(
    (entry) => entry.apps.length,
  )
