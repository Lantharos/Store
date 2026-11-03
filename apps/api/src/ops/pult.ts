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
