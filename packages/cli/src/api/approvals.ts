import { hostname } from "node:os"
import { API_BASE, type Approval, type ApprovalAction } from "@schelf/protocol"
import { request } from "@schelf/publisher"
import type { Args } from "../args.ts"
import { openBrowser } from "../ui/browser.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, emit, Failure, line, note, problem, step } from "../ui/output.ts"
import { bold, dim, interactive, link } from "../ui/style.ts"

const POLL_MS = 2000

const base = (api: string) => `${api}${API_BASE}/dev/requests`

export const approvalOf = (api: string, token: string, id: string) =>
  request<Approval>(`${base(api)}/${encodeURIComponent(id)}`, { token })

export function printApproval(approval: Approval) {
  approval.steps.forEach((entry, index) => {
    const mark = entry.outcome === "done" ? "✓" : entry.outcome === "failed" ? "✕" : `${index + 1}.`
    line(`${dim(mark)} ${entry.summary}`)
    if (entry.detail) problem(`  ${entry.detail}`)
  })
}

export const waits = (args: Args) =>
  args.flags.has("wait") || (interactive && !args.flags.has("no-wait") && !args.flags.has("json"))

export async function waitForApproval(api: string, token: string, id: string) {
  for (;;) {
    const approval = await approvalOf(api, token, id)
    if (approval.status !== "pending") return approval
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

export function settled(approval: Approval) {
  emit(approval)
  if (approval.status === "pending") {
    note(`Waiting for you to approve it. schelf request status ${approval.id} --wait waits for it.`)
    return EXIT.waiting
  }
  blank()
  printApproval(approval)
  blank()
  if (approval.status === "done") {
    done("Approved and done")
    return EXIT.ok
  }
  if (approval.status === "failed")
    throw new Failure("Approved, but not everything happened", undefined, EXIT.failed)
  throw new Failure(
    approval.status === "expired" ? "The request expired" : "The request was cancelled",
    undefined,
    EXIT.declined,
  )
}

export async function presentApproval(
  api: string,
  token: string,
  approval: Pick<Approval, "id" | "url">,
  args: Args,
) {
  line(`${bold("Approve it in your browser:")} ${link(approval.url)}`)
  openBrowser(approval.url)
  const decided = waits(args)
    ? await step("Waiting for your approval", () => waitForApproval(api, token, approval.id))
    : await approvalOf(api, token, approval.id)
  return { code: settled(decided), approval: decided }
}

export async function askApproval(api: string, token: string, actions: ApprovalAction[], args: Args) {
  const approval = await request<Approval>(base(api), {
    method: "POST",
    token,
    body: JSON.stringify({ actions, host: hostname() }),
  })
  blank()
  line("This needs you to approve it:")
  printApproval(approval)
  blank()
  return presentApproval(api, token, approval, args)
}
