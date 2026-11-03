import { REPORT_KINDS, type ReportRequest } from "@schelf/protocol"
import { fail } from "@sveltejs/kit"
import { post } from "#lib/api/server.ts"
import { appPage } from "#lib/api/store.ts"

export async function load({ params }) {
  const { app } = await appPage(params.id)
  return { app: { id: app.id, kind: app.kind, name: app.listing.en!.name, icon: app.icon } }
}

const text = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export const actions = {
  default: async ({ params, request }) => {
    const form = await request.formData()
    const kind = text(form, "kind") as ReportRequest["kind"] | undefined
    const report = {
      app: params.id,
      kind,
      reason: text(form, "reason"),
      explanation: text(form, "explanation"),
      location: text(form, "location"),
      name: text(form, "name"),
      email: text(form, "email"),
    }
    if (!kind || !REPORT_KINDS.includes(kind))
      return fail(400, { report, error: "Choose what kind of problem it is." })
    if (!report.reason || !report.explanation)
      return fail(400, { report, error: "Tell us what's wrong and why." })
    if (kind === "dmca" && (!report.name || !report.email)) {
      return fail(400, { report, error: "A copyright notice needs your name and email." })
    }
    const response = await post("/reports", report)
    if (!response.ok) {
      const body = (await response.json()) as { error?: string }
      return fail(response.status, {
        report,
        error: body.error ?? "That didn't go through. Try again in a moment.",
      })
    }
    return { sent: true }
  },
}
