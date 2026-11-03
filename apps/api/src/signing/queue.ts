import { env } from "cloudflare:workers"
import { rebuildApp, rebuildCatalog, rebuildRevocations } from "./rebuild.ts"

export type SigningJob = { type: "app"; id: string } | { type: "catalog" } | { type: "revocations" }

export function resign(...jobs: SigningJob[]) {
  return env.SIGNING.sendBatch(jobs.map((body) => ({ body })))
}

export function resignApp(id: string) {
  return resign({ type: "app", id }, { type: "catalog" })
}

export async function signQueued(batch: MessageBatch<SigningJob>) {
  const apps = new Set<string>()
  let catalog = false
  let revocations = false
  for (const { body } of batch.messages) {
    if (body.type === "app") apps.add(body.id)
    else if (body.type === "catalog") catalog = true
    else revocations = true
  }
  for (const id of apps) await rebuildApp(id)
  if (catalog) await rebuildCatalog()
  if (revocations) await rebuildRevocations()
}
