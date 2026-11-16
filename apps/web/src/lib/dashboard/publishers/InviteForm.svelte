<script lang="ts">
  import { inviteMember, ROLE_NAMES, type Role, type SentInvite } from "@schelf/protocol"
  import Select from "../../ui/fields/Select.svelte"
  import { Task } from "../../ui/overlay/task.svelte.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { roleOptions } from "./roles.ts"

  let { oninvited }: { oninvited: (invite: SentInvite) => void } = $props()
  let to = $state("")
  let role = $state<Role>("developer")
  const save = new Task({ inline: true })

  async function invite(event: SubmitEvent) {
    event.preventDefault()
    const value = to.trim()
    const parsed = inviteMember.safeParse(
      value.includes("@") && !value.startsWith("@") ? { email: value, role } : { github: value, role },
    )
    if (!parsed.success) {
      save.error = value.includes("@") ? "That isn't an email address" : parsed.error.issues[0]!.message
      return
    }
    await save.run(async () => {
      oninvited(await api.post<SentInvite>(endpoints.invites(session.publisher!.id), parsed.data))
      toasts.show(`Invited ${value}`)
      to = ""
    })
  }
</script>

<form class="flex flex-col gap-2 sm:flex-row" onsubmit={invite}>
  <input bind:value={to} class="field" placeholder="Email or GitHub username" aria-label="Email or GitHub username" autocomplete="off" spellcheck="false" />
  <div class="sm:w-40 sm:shrink-0"><Select bind:value={role} label="Role" options={roleOptions(session.can("owners"))} /></div>
  <button class="button button-primary shrink-0" disabled={save.busy || !to.trim()}>Invite</button>
</form>
<p class="mt-2 text-[13px] {save.error ? 'text-danger' : 'text-ink-muted'}" role={save.error ? "alert" : undefined}>
  {save.error ?? `${ROLE_NAMES[role].label}s: ${ROLE_NAMES[role].about.toLowerCase()}.`}
</p>
