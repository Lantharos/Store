import { waitUntil } from "cloudflare:workers"
import { rolloutsFrozen, submissionsOpen } from "./define/flags.ts"
import { backOffice } from "./pult.ts"

export type OpsEvent =
  | { type: "release"; release: string; kind: "submission" | "update" }
  | { type: "report"; report: string }
  | { type: "verification"; verification: string; message?: { from: string; text: string } }

async function deliver(pult: NonNullable<ReturnType<typeof backOffice>>["pult"], event: OpsEvent) {
  const { sendRelease, sendReport, sendVerification } = await import("./items.ts")
  if (event.type === "release") return sendRelease(pult, event.release, event.kind)
  if (event.type === "report") return sendReport(pult, event.report)
  return sendVerification(pult, event.verification, event.message)
}

export function tellOps(event: OpsEvent) {
  const office = backOffice()
  if (!office) {
    console.log(`Pult isn't connected, so this waits in the store: ${JSON.stringify(event)}`)
    return
  }
  waitUntil(deliver(office.pult, event).catch((error) => console.error(error)))
}

export async function acceptingSubmissions() {
  return (await backOffice()?.pult.flag(submissionsOpen)) ?? true
}

export async function rolloutsAreFrozen() {
  return (await backOffice()?.pult.flag(rolloutsFrozen)) ?? false
}
