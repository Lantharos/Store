<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import { onMount } from "svelte"
  import { date } from "../../format.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { auth } from "../api/auth.ts"

  interface Passkey {
    id: string
    name?: string | null
    createdAt: Date | string
  }

  let passkeys = $state<Passkey[] | null>(null)

  async function load() {
    const { data, error } = await auth.passkey.listUserPasskeys()
    if (error) toasts.show(error.message ?? "Couldn't load your passkeys", "danger")
    passkeys = (data as Passkey[] | null) ?? []
  }

  async function add() {
    const result = await auth.passkey.addPasskey({ name: navigator.platform || "Passkey" })
    if (result?.error) toasts.show(result.error.message ?? "That passkey wasn't added", "danger")
    else {
      toasts.show("Passkey added")
      await load()
    }
  }

  async function remove(passkey: Passkey) {
    const previous = passkeys
    passkeys = passkeys!.filter((item) => item.id !== passkey.id)
    const { error } = await auth.passkey.deletePasskey({ id: passkey.id })
    if (error) {
      passkeys = previous
      toasts.show(error.message ?? "That passkey wasn't removed", "danger")
    }
  }

  onMount(load)
</script>

<div class="flex items-start gap-4 py-4">
  <KeyRound class="mt-0.5 size-5 shrink-0 text-ink-muted" />
  <div class="min-w-0 flex-1">
    <p class="font-medium">Passkeys</p>
    {#if passkeys === null}
      <p class="placeholder mt-1 h-4 w-40"></p>
    {:else if passkeys.length}
      <ul class="mt-1 space-y-1.5 text-[15px] text-ink-soft">
        {#each passkeys as passkey (passkey.id)}
          <li class="flex items-center justify-between gap-3">
            <span class="truncate">{passkey.name || "Passkey"}<span class="text-ink-muted">{" · "}added {date(passkey.createdAt)}</span></span>
            <button type="button" class="text-[13px] text-danger hover:underline" onclick={() => remove(passkey)}>Remove</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-[15px] text-ink-muted">Sign in with your fingerprint, face or security key.</p>
    {/if}
  </div>
  <button type="button" class="button button-sm button-quiet" onclick={add}>Add</button>
</div>
