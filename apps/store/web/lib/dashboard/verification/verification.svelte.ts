import type { SaveVerification, Verification, VerificationState } from "@schelf/protocol"
import { attempt } from "../../ui/overlay/task.svelte.ts"
import { toasts } from "../../ui/overlay/toasts.svelte.ts"
import { api } from "../api/client.ts"
import { endpoints } from "../api/endpoints.ts"
import { type Resource, resource } from "../api/resource.svelte.ts"

export class VerificationFlow {
  state: Resource<VerificationState>
  busy = $state<string | null>(null)

  constructor(readonly publisherId: string) {
    this.state = resource<VerificationState>(endpoints.verification(publisherId))
  }

  get current(): Verification | null {
    return this.state.data?.current ?? null
  }

  async run(label: string, request: () => Promise<unknown>) {
    this.busy = label
    const succeeded = await attempt(async () => {
      await request()
      return true
    })
    this.busy = null
    return succeeded ?? false
  }

  change(label: string, request: () => Promise<VerificationState>, done?: string) {
    return this.run(label, async () => {
      this.state.set(await request())
      if (done) toasts.show(done)
    })
  }

  start() {
    return this.change("start", () => api.post(endpoints.verification(this.publisherId)))
  }

  save(changes: SaveVerification) {
    return this.change("save", () => api.patch(endpoints.verification(this.publisherId), changes))
  }

  check() {
    return this.change("check", () => api.post(endpoints.verificationCheck(this.publisherId)))
  }

  sendCode() {
    return this.run("code", () => api.post(endpoints.contactCode(this.publisherId)))
  }

  confirm(code: string) {
    return this.change(
      "confirm",
      () => api.post(endpoints.contactConfirm(this.publisherId), { code }),
      "Email confirmed",
    )
  }

  proveGithub() {
    return this.change(
      "github",
      () => api.post(endpoints.githubOrg(this.publisherId)),
      "GitHub organisation proven",
    )
  }

  attach(file: File) {
    return this.change("attach", () =>
      api.upload(`${endpoints.documents(this.publisherId)}?name=${encodeURIComponent(file.name)}`, file),
    )
  }

  detach(id: string) {
    return this.change("detach", () => api.delete(endpoints.document(this.publisherId, id)))
  }

  submit() {
    return this.change(
      "submit",
      () => api.post(endpoints.submitVerification(this.publisherId)),
      "Sent for review",
    )
  }

  reply(text: string) {
    return this.change(
      "reply",
      () => api.post(endpoints.replyVerification(this.publisherId), { text }),
      "Sent",
    )
  }
}
