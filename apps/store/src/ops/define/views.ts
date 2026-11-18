import { view } from "@lantharos/pult"
import { updates } from "./inboxes.ts"

export const routineUpdates = view("routine-updates", {
  label: "Routine updates",
  inbox: updates,
  filter: { state: "open", tags: ["routine"] },
  sort: "firstSeen",
})
