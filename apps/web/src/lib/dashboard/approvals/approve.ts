import type { Approval } from "@schelf/protocol"
import { auth } from "../api/auth.ts"
import { api } from "../api/client.ts"

const path = (id: string) => `/requests/${encodeURIComponent(id)}`

export const loadApproval = (id: string) => api.get<Approval>(path(id))
export const cancelApproval = (id: string) => api.post<Approval>(`${path(id)}/cancel`)

async function confirmPresence(hasPasskey: boolean) {
  if (!hasPasskey) {
    const added = await auth.passkey.addPasskey({ name: "Passkey" })
    if (added?.error) throw new Error(added.error.message ?? "The passkey wasn't added")
  }
  const signed = await auth.signIn.passkey()
  if (signed?.error) throw new Error(signed.error.message ?? "That passkey didn't work")
}

export async function approve(approval: Approval, hasPasskey: boolean) {
  if (approval.passkey) await confirmPresence(hasPasskey)
  return api.post<Approval>(`${path(approval.id)}/approve`)
}
