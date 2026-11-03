import type { SaveVerification, Verification, VerificationState } from "@schelf/protocol"
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

  async run(label: string, request: () => Promise<VerificationState>, done?: string) {
    this.busy = label
    try {
      this.state.set(await request())
      if (done) toasts.show(done)
      return true
    } catch (error) {
      toasts.error(error)
      return false
    } finally {
      this.busy = null
    }
  }

  start() {
    return this.run("start", () => api.post(endpoints.verification(this.publisherId)))
  }

  save(changes: SaveVerification) {
    return this.run("save", () => api.patch(endpoints.verification(this.publisherId), changes))
  }

  check() {
    return this.run("check", () => api.post(endpoints.verificationCheck(this.publisherId)))
  }

  async sendCode() {
    this.busy = "code"
    try {
      await api.post(endpoints.contactCode(this.publisherId))
      return true
    } catch (error) {
      toasts.error(error)
      return false
    } finally {
      this.busy = null
    }
  }

  confirm(code: string) {
    return this.run(
      "confirm",
      () => api.post(endpoints.contactConfirm(this.publisherId), { code }),
      "Email confirmed",
    )
  }

  proveGithub() {
    return this.run(
      "github",
      () => api.post(endpoints.githubOrg(this.publisherId)),
      "GitHub organisation proven",
    )
  }

  attach(file: File) {
    return this.run("attach", () =>
      api.upload(`${endpoints.documents(this.publisherId)}?name=${encodeURIComponent(file.name)}`, file),
    )
  }

  detach(id: string) {
    return this.run("detach", () => api.delete(endpoints.document(this.publisherId, id)))
  }

  submit() {
    return this.run(
      "submit",
      () => api.post(endpoints.submitVerification(this.publisherId)),
      "Sent for review",
    )
  }

  reply(text: string) {
    return this.run("reply", () => api.post(endpoints.replyVerification(this.publisherId), { text }), "Sent")
  }
}
