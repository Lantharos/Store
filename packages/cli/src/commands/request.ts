import { API_BASE, type Approval } from "@schelf/protocol"
import { request as call } from "@schelf/publisher"
import { approvalOf, settled, waitForApproval, waits } from "../api/approvals.ts"
import { session } from "../api/auth.ts"
import { type Args, apiOrigin } from "../args.ts"
import { EXIT } from "../ui/exit.ts"
import { Failure, step } from "../ui/output.ts"

export async function request(args: Args) {
  const [verb, id] = args.positionals
  if (!id || (verb !== "status" && verb !== "cancel"))
    throw new Failure(
      "Usage: schelf request status <id> [--wait], or schelf request cancel <id>",
      undefined,
      EXIT.usage,
    )
  const api = apiOrigin(args)
  const { token } = await session(api)
  if (verb === "cancel")
    return settled(
      await call<Approval>(`${api}${API_BASE}/dev/requests/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        token,
      }),
    )
  if (!waits(args)) return settled(await approvalOf(api, token, id))
  return settled(await step("Waiting for your approval", () => waitForApproval(api, token, id)))
}
