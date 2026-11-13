<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import Mail from "@lucide/svelte/icons/mail"
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert"
  import type { ChannelAccess, CreatedChannelToken } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { ago } from "../../format.ts"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { open = $bindable(), appId, channel }: { open: boolean; appId: string; channel: string } = $props()

  let access = $state<ChannelAccess | null>(null)
  let email = $state("")
  let tokenName = $state("")
  let created = $state<CreatedChannelToken | null>(null)
  let busy = $state(false)
  const tokens = $derived(access?.tokens.filter((token) => !token.revoked_at) ?? [])

  $effect(() => {
    if (open)
      api.get<ChannelAccess>(endpoints.channelAccess(appId, channel)).then((found) => (access = found))
  })

  async function run<T>(task: () => Promise<T>) {
    busy = true
    try {
      return await task()
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }

  async function invite(event: SubmitEvent) {
    event.preventDefault()
    const next = await run(() =>
      api.post<ChannelAccess>(endpoints.channelInvites(appId, channel), { email: email.trim() }),
    )
    if (!next) return
    access = next
    email = ""
  }

  async function makeToken(event: SubmitEvent) {
    event.preventDefault()
    const made = await run(() =>
      api.post<CreatedChannelToken>(endpoints.channelTokens(appId, channel), { name: tokenName.trim() }),
    )
    if (!made) return
    created = made
    tokenName = ""
    access = await api.get<ChannelAccess>(endpoints.channelAccess(appId, channel))
  }

  async function remove(path: string) {
    const next = await run(() => api.delete<ChannelAccess>(path))
    if (next) access = next
  }
</script>

<Dialog bind:open class="max-w-lg" onclose={() => (created = null)}>
  <div class="space-y-6 p-6 sm:p-7">
    <div>
      <h2 class="font-semibold">Who gets {channel}</h2>
      <p class="mt-1 text-[13px] leading-relaxed text-ink-muted">People sign in to Schelf with the address you invite. Machines use a download token.</p>
    </div>

    <form class="flex gap-2" onsubmit={invite}>
      <input class="field min-w-0 flex-1" type="email" placeholder="name@example.com" aria-label="Email address to invite" bind:value={email} required />
      <button class="button button-primary" disabled={busy || !email.trim()}>Invite</button>
    </form>

    <ul class="divide-y divide-hairline">
      {#each access?.invites ?? [] as entry (entry.id)}
        <li class="flex items-center gap-3 py-2.5">
          <Mail class="size-[18px] shrink-0 text-ink-muted" />
          <span class="min-w-0 flex-1 truncate text-[15px]">{entry.email}</span>
          <button type="button" class="button button-sm button-quiet" disabled={busy} onclick={() => remove(endpoints.channelInvite(appId, channel, entry.id))}>Remove</button>
        </li>
      {:else}
        <li class="py-2.5 text-[15px] text-ink-muted">{access ? "Nobody yet." : "Loading…"}</li>
      {/each}
    </ul>

    {#if created}
      <div class="space-y-2">
        <p class="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
          <TriangleAlert class="mt-0.5 size-[18px] shrink-0 text-caution" />
          Copy {created.name} now; it's only shown once.
        </p>
        <div class="flex items-center gap-2 rounded-2xl bg-well py-2 pr-2 pl-4">
          <code class="min-w-0 flex-1 truncate font-mono text-[13px]">{created.token}</code>
          <CopyButton text={created.token} />
        </div>
      </div>
    {/if}

    <form class="flex gap-2" onsubmit={makeToken}>
      <input class="field min-w-0 flex-1" placeholder="Token name, like Test lab" aria-label="Download token name" bind:value={tokenName} required maxlength="80" />
      <button class="button button-quiet" disabled={busy || !tokenName.trim()}>Make a token</button>
    </form>

    {#if tokens.length}
      <ul class="divide-y divide-hairline">
        {#each tokens as token (token.id)}
          <li class="flex items-center gap-3 py-2.5">
            <KeyRound class="size-[18px] shrink-0 text-ink-muted" />
            <span class="min-w-0 flex-1">
              <span class="block text-[15px]">{token.name}</span>
              <span class="block text-[13px] text-ink-muted">{token.last_used_at ? `Used ${ago(token.last_used_at)}` : "Never used"}</span>
            </span>
            <button type="button" class="button button-sm button-danger" disabled={busy} onclick={() => remove(endpoints.channelToken(appId, channel, token.id))}>Revoke</button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex justify-end"><button type="button" class="button button-primary" onclick={() => (open = false)}>Done</button></div>
  </div>
</Dialog>
