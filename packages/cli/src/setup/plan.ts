import { type ApprovalAction, NEW_PUBLISHER } from "@schelf/protocol"
import { askApproval } from "../api/approvals.ts"
import type { Dashboard } from "../api/dashboard.ts"
import type { Args } from "../args.ts"
import { EXIT } from "../ui/exit.ts"
import { Failure } from "../ui/output.ts"
import type { Owner } from "./register.ts"

export async function runPlan(
  api: string,
  token: string,
  account: Dashboard,
  owner: Owner,
  plan: ApprovalAction[],
  args: Args,
) {
  if (!plan.length) return owner
  const { code } = await askApproval(api, token, plan, args)
  if (code === EXIT.waiting)
    throw new Failure("Waiting for your approval", "Run schelf init again once it's approved.", EXIT.waiting)
  plan.length = 0
  if (owner.id !== NEW_PUBLISHER) return owner
  const created = (await account.account()).publishers.find((publisher) => publisher.kind === "person")
  return created!
}
