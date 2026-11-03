import { env } from "cloudflare:workers"
import { createPult, type Pult } from "@lantharos/pult"
import project from "../../.pult/index.ts"

interface BackOffice {
  pult: Pult
  handle: ReturnType<Pult["handler"]>
}

let office: BackOffice | undefined

export function backOffice() {
  if (!env.PULT_KEY) return null
  if (!office) {
    const pult = createPult({ key: env.PULT_KEY, project })
    office = { pult, handle: pult.handler() }
  }
  return office
}

let definitionsPublished = false

export async function publishDefinitions() {
  const office = backOffice()
  if (!office || definitionsPublished) return
  const marker = new Request(`${env.PUBLIC_URL}/internal/pult-definitions/${project.manifest.version}`)
  if (!(await caches.default.match(marker))) {
    await office.pult.deploy()
    await caches.default.put(marker, new Response(null, { headers: { "cache-control": "max-age=31536000" } }))
  }
  definitionsPublished = true
}
