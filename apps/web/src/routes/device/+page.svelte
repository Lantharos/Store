<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import { APP_CLIENT_ID } from "@schelf/protocol"
  import { untrack } from "svelte"
  import { auth } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Logo from "#lib/Logo.svelte"

  const CODE_LENGTH = 8

  let { data } = $props()
  let code = $state(untrack(() => formatted(data.code)))
  let outcome = $state<"ask" | "approved" | "denied">("ask")
  let error = $state<string | null>(null)
  let busy = $state(false)
  let client = $state<string | null>(null)
  const forApp = $derived(client === APP_CLIENT_ID)

  $effect(() => {
    if (code.length !== CODE_LENGTH) return
    auth.device({ query: { user_code: code } }).then((found) => (client = found.data?.client_id ?? null))
  })

  function formatted(value: string) {
    return value
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH)
  }

  function input(event: Event & { currentTarget: HTMLInputElement }) {
    code = formatted(event.currentTarget.value)
    event.currentTarget.value = code
  }

  async function decide(approve: boolean) {
    busy = true
    error = null
    const check = await auth.device({ query: { user_code: code } })
    if (check.error) {
      error = forApp
        ? "That code has expired. Sign in again from Schelf for a new one."
        : "That code has expired. Run schelf login again for a new one."
      busy = false
      return
    }
    const result = approve
      ? await auth.device.approve({ userCode: code })
      : await auth.device.deny({ userCode: code })
    busy = false
    if (result.error) error = result.error.error_description || "That didn't work. Try again."
    else outcome = approve ? "approved" : "denied"
  }
</script>

<svelte:head><title>{forApp ? "Sign in Schelf on this computer" : "Sign in the schelf command"} · Schelf</title><meta name="robots" content="noindex" /></svelte:head>

<main class="grid min-h-svh place-items-center px-4 py-12">
  <div class="enter w-full max-w-[22rem] text-center">
    {#if outcome === "approved"}
      <CircleCheck class="mx-auto size-10 text-accent" />
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">You're signed in</h1>
      <p class="mt-1.5 text-[15px] text-ink-soft">{forApp ? "Go back to Schelf." : "Go back to your terminal."} You can close this page.</p>
    {:else if outcome === "denied"}
      <Logo class="mx-auto size-10" />
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Sign-in cancelled</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{forApp ? "Schelf wasn't" : "Your terminal wasn't"} signed in. If you didn't start this, there's nothing else to do.</p>
    {:else}
      <Logo class="mx-auto size-10" />
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">{forApp ? "Sign in Schelf on this computer?" : "Sign in the schelf command?"}</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        {#if forApp}
          It gets the apps you're invited to try as <span class="text-ink">{session.account?.user.email}</span>. Check the code matches the one Schelf shows.
        {:else}
          It will act as <span class="text-ink">{session.account?.user.email}</span>. Check the code matches your terminal.
        {/if}
      </p>
      <input value={code} oninput={input} aria-label="Code" autocomplete="off" spellcheck="false" class="field mt-7 h-14 text-center font-mono text-2xl tracking-[0.15em] uppercase" />
      {#if error}<p class="mt-3 text-[15px] text-danger" role="alert">{error}</p>{/if}
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button type="button" class="button button-quiet" disabled={busy} onclick={() => decide(false)}>Cancel</button>
        <button type="button" class="button button-primary" disabled={busy || code.length < CODE_LENGTH} onclick={() => decide(true)}>Sign in</button>
      </div>
    {/if}
  </div>
</main>
