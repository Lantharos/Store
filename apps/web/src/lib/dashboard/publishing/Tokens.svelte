<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert"
  import type { CreatedToken, DashboardToken } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { ago, date } from "../../format.ts"
  import Field from "../../ui/fields/Field.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { appId, tokens = $bindable() }: { appId: string; tokens: DashboardToken[] } = $props()

  let creating = $state(false)
  let name = $state("")
  let created = $state<CreatedToken | null>(null)
  let revoking = $state<DashboardToken | null>(null)
  let revokeOpen = $state(false)
  let busy = $state(false)
  const active = $derived(tokens.filter((token) => !token.revoked_at))

  async function create(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    try {
      created = await api.post<CreatedToken>(endpoints.tokens(appId), { name: name.trim() })
      const { token: _secret, ...stored } = created
      tokens = [...tokens, stored]
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }

  async function revoke() {
    const token = revoking!
    await api.delete(endpoints.token(appId, token.id))
    tokens = tokens.filter((item) => item.id !== token.id)
    toasts.show(`${token.name} revoked`)
  }
</script>

<section>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold">Tokens</h2>
      <p class="mt-1 max-w-xl text-[15px] leading-relaxed text-ink-muted">
        For <span class="font-mono text-[13px]">schelf publish</span> outside GitHub Actions. Releases sent with a token are marked as uploaded by you.
      </p>
    </div>
    <button type="button" class="button button-sm button-quiet" onclick={() => ((name = ""), (created = null), (creating = true))}>Create a token</button>
  </div>
  <ul class="mt-4 divide-y divide-hairline">
    {#each active as token (token.id)}
      <li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
        <KeyRound class="size-5 shrink-0 text-ink-muted" />
        <div class="min-w-0 flex-1">
          <p class="font-medium">{token.name}</p>
          <p class="text-[13px] text-ink-muted">{token.last_used_at ? `Last used ${ago(token.last_used_at)}` : "Never used"} · expires {date(token.expires_at)}</p>
        </div>
        <button type="button" class="button button-sm button-danger" onclick={() => ((revoking = token), (revokeOpen = true))}>Revoke</button>
      </li>
    {:else}
      <li class="py-6 text-[15px] text-ink-muted">No tokens. You only need one to publish from somewhere other than GitHub Actions.</li>
    {/each}
  </ul>
</section>

<Dialog bind:open={creating} onclose={() => (created = null)}>
  {#if created}
    <div class="space-y-5 p-6 sm:p-7">
      <h2 class="text-xl font-semibold">Copy your token now</h2>
      <p class="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
        <TriangleAlert class="mt-0.5 size-[18px] shrink-0 text-caution" />
        This is the only time it's shown. Store it as a secret where you publish from.
      </p>
      <div class="flex items-center gap-2 rounded-2xl bg-well py-2 pr-2 pl-4">
        <code class="min-w-0 flex-1 truncate font-mono text-[13px]">{created.token}</code>
        <CopyButton text={created.token} />
      </div>
      <p class="text-[13px] text-ink-muted">Use it with <span class="font-mono">SCHELF_TOKEN=… bunx schelf publish</span>.</p>
      <div class="flex justify-end"><button type="button" class="button button-primary" onclick={() => ((creating = false), (created = null))}>Done</button></div>
    </div>
  {:else}
    <form class="space-y-5 p-6 sm:p-7" onsubmit={create}>
      <h2 class="text-xl font-semibold">Create a token</h2>
      <Field label="Name" hint="Where you'll use it, like “Laptop” or “Buildkite”.">
        <input class="field" bind:value={name} required maxlength="80" />
      </Field>
      <p class="text-[13px] text-ink-muted">It can publish releases of this app only, and expires in a year.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="button button-quiet" onclick={() => (creating = false)}>Cancel</button>
        <button class="button button-primary" disabled={busy || !name.trim()}>Create</button>
      </div>
    </form>
  {/if}
</Dialog>

<Confirm bind:open={revokeOpen} title="Revoke {revoking?.name}?" confirm="Revoke" danger onconfirm={revoke}>
  <p>Anything using this token can't publish any more. You can create a new one at any time.</p>
</Confirm>
