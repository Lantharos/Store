import type { VerificationStatus } from "@schelf/protocol"
import { fail } from "../lib/http.ts"

const MOVES = {
  submit: { from: ["draft"], to: "open" },
  askForMore: { from: ["open"], to: "more-requested" },
  reply: { from: ["open", "more-requested"], to: "open" },
  approve: { from: ["open"], to: "approved" },
  reject: { from: ["open", "more-requested"], to: "rejected" },
  revoke: { from: ["approved"], to: "revoked" },
} as const satisfies Record<string, { from: readonly VerificationStatus[]; to: VerificationStatus }>

export type VerificationMove = keyof typeof MOVES

const EDITABLE: readonly VerificationStatus[] = ["draft", "more-requested"]
const FINISHED: readonly VerificationStatus[] = ["rejected", "revoked"]

export function canMove(status: VerificationStatus, move: VerificationMove) {
  return (MOVES[move].from as readonly VerificationStatus[]).includes(status)
}

export function moved(status: VerificationStatus, move: VerificationMove): VerificationStatus {
  if (!canMove(status, move))
    fail(409, `A request that's ${status.replace("-", " ")} can't be changed that way`)
  return MOVES[move].to
}

export function editable(status: VerificationStatus) {
  if (!EDITABLE.includes(status))
    fail(409, "This request is with the reviewer; wait for an answer before changing it")
}

export function startsOver(status: VerificationStatus | undefined) {
  return status === undefined || FINISHED.includes(status)
}
