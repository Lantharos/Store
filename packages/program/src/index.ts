import { DOWNLOAD_ORIGIN, ROOT_KEY } from "@schelf/protocol"
import type { Store } from "./signed.ts"

export { type Place, schelfProgram } from "./program.ts"
export { Offline, type Store } from "./signed.ts"
export { thisComputer } from "./target.ts"

export const STORE: Store = { origin: DOWNLOAD_ORIGIN, rootKey: ROOT_KEY.public_key }
