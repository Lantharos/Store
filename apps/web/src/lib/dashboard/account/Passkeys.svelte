<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import { onMount } from "svelte"
  import { date } from "../../format.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { auth } from "../api/auth.ts"
  import { session } from "../api/session.svelte.ts"
  import MethodRow from "./MethodRow.svelte"

  interface Passkey {
    id: string
    name?: string | null
    createdAt: Date | string
  }

  let passkeys = $state<Passkey[] | null>(null)
  let adding = $state(false)
  const expected = $derived(session.account?.passkeys ?? 0)

  const SYSTEMS: [RegExp, string][] = [
    [/iPhone/, "iPhone"],
    [/iPad/, "iPad"],
    [/Android/, "Android"],
    [/Mac/, "Mac"],
    [/Windows/, "Windows"],
    [/Linux/, "Linux"],
  ]

  function deviceName() {
    const system = SYSTEMS.find(([pattern]) => pattern.test(navigator.userAgent))?.[1]
    return system ? `Passkey on ${system}` : "Passkey"
  }

  async function load() {
    const { data, error } = await auth.passkey.listUserPasskeys()
    if (error) toasts.show(error.message ?? "Couldn't load your passkeys", "danger")
    passkeys = (data as Passkey[] | null) ?? []
  }

  async function add() {
    adding = true
    const result = await auth.passkey.addPasskey({ name: deviceName() })
    adding = false
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

<MethodRow title="Passkeys" text="Sign in with your fingerprint, face or security key.">
  {#snippet icon()}<KeyRound class="size-5" />{/snippet}
  {#snippet action()}
    <button type="button" class="button button-sm button-quiet" disabled={adding} onclick={add}>Add</button>
  {/snippet}
  {#if passkeys === null ? expected : passkeys.length}
    <ul class="divide-y divide-hairline">
      {#if passkeys === null}
        {#each { length: expected } as _}
          <li class="flex h-12 items-center"><span class="placeholder h-4 w-48"></span></li>
        {/each}
      {:else}
        {#each passkeys as passkey (passkey.id)}
          <li class="flex h-12 items-center justify-between gap-4">
            <p class="flex min-w-0 gap-1.5 text-[15px]">
              <span class="truncate">{passkey.name || "Passkey"}</span>
              <span class="shrink-0 text-ink-muted">· added {date(passkey.createdAt)}</span>
            </p>
            <button type="button" class="button button-sm shrink-0 text-danger hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]" onclick={() => remove(passkey)}>Remove</button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</MethodRow>
