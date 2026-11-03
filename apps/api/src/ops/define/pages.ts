import { b, home } from "@lantharos/pult"
import { rolloutsFrozen, submissionsOpen } from "./flags.ts"
import { reports, submissions, updates } from "./inboxes.ts"
import { prepareKey, publishKeys, resign } from "./store.ts"
import { verification } from "./verification.ts"

export default home([
  b.columns(
    [b.count(submissions, { filter: { state: "open" }, label: "New apps" })],
    [b.count(updates, { filter: { state: "open" }, label: "Updates" })],
    [b.count(reports, { filter: { state: "open" }, label: "Reports" })],
    [b.count(verification, { filter: { state: "open" }, label: "Verification" })],
  ),
  b.columns(
    [b.items(submissions, { filter: { state: "open" }, limit: 5 })],
    [b.items(updates, { filter: { state: "open" }, limit: 5 })],
  ),
  b.columns(
    [b.items(reports, { filter: { state: "open" }, limit: 5 })],
    [b.items(verification, { filter: { state: "open" }, limit: 5 })],
  ),
  b.flag(submissionsOpen),
  b.flag(rolloutsFrozen),
  b.actions(resign, prepareKey, publishKeys),
])
