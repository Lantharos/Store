<script lang="ts">
  import { type DashboardPublisher, ROLE_NAMES } from "@schelf/protocol"
  import { goto } from "$app/navigation"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import PublisherMark from "./PublisherMark.svelte"

  let busy = $state<string | null>(null)
  const invites = $derived(session.account?.invites ?? [])

  async function answer(id: string, accept: boolean) {
    busy = id
    try {
      if (accept) {
        const joined = await api.post<DashboardPublisher>(endpoints.acceptInvite(id))
        await session.refreshAccount()
        await session.use(joined.id)
        toasts.show(`You're in ${joined.name}`)
        await goto("/dashboard")
      } else {
        await api.post(endpoints.declineInvite(id))
        await session.refreshAccount()
      }
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = null
    }
  }
</script>

{#if invites.length}
  <ul class="space-y-2">
    {#each invites as invite (invite.id)}
      {@const role = ROLE_NAMES[invite.role].label.toLowerCase()}
      <li class="enter flex flex-wrap items-center gap-4 rounded-2xl bg-well p-4">
        <PublisherMark logo={invite.publisher.logo} name={invite.publisher.name} class="size-10 text-[15px]" />
        <p class="min-w-0 flex-1 text-[15px] leading-snug">
          <span class="font-medium">{invite.publisher.name}</span>
          <span class="block text-ink-soft">{invite.invited_by ?? "Someone"} invited you as {role === "admin" ? "an" : "a"} {role}.</span>
        </p>
        <div class="flex gap-2">
          <button type="button" class="button button-sm button-quiet" disabled={busy !== null} onclick={() => answer(invite.id, false)}>Decline</button>
          <button type="button" class="button button-sm button-primary" disabled={busy !== null} onclick={() => answer(invite.id, true)}>Join</button>
        </div>
      </li>
    {/each}
  </ul>
{/if}
