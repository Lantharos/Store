import { waitUntil } from "cloudflare:workers"
import { rolloutsFrozen, submissionsOpen } from "./define/flags.ts"
import { sendRelease, sendReport } from "./items.ts"
import { backOffice } from "./pult.ts"

export type OpsEvent =
  | { type: "release"; release: string; kind: "submission" | "update" }
  | { type: "report"; report: string }

export function tellOps(event: OpsEvent) {
  const office = backOffice()
  if (!office) {
    console.log(`Pult isn't connected, so this waits in the store: ${JSON.stringify(event)}`)
    return
  }
  waitUntil(
    (event.type === "release"
      ? sendRelease(office.pult, event.release, event.kind)
      : sendReport(office.pult, event.report)
    ).catch((error) => console.error(error)),
  )
}

export async function acceptingSubmissions() {
  return (await backOffice()?.pult.flag(submissionsOpen)) ?? true
}

export async function rolloutsAreFrozen() {
  return (await backOffice()?.pult.flag(rolloutsFrozen)) ?? false
}
