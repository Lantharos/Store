<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import { untrack } from "svelte"
  import { auth } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Logo from "#lib/Logo.svelte"

  let { data } = $props()
  let code = $state(untrack(() => data.code))
  let outcome = $state<"ask" | "approved" | "denied">("ask")
  let error = $state<string | null>(null)
  let busy = $state(false)
  const userCode = $derived(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase())

  async function decide(approve: boolean) {
    busy = true
    error = null
    const check = await auth.device({ query: { user_code: userCode } })
    if (check.error) {
      error = "That code isn't valid any more. Run schelf login again for a new one."
      busy = false
      return
    }
    const result = approve ? await auth.device.approve({ userCode }) : await auth.device.deny({ userCode })
    busy = false
    if (result.error) error = result.error.error_description || "That didn't work"
    else outcome = approve ? "approved" : "denied"
  }
</script>

<svelte:head><title>Sign in the schelf command · Schelf</title><meta name="robots" content="noindex" /></svelte:head>

<main class="grid min-h-svh place-items-center px-4 py-12">
  <div class="enter w-full max-w-[24rem]">
    <Logo class="size-10" />
    {#if outcome === "approved"}
      <CircleCheck class="mt-6 size-8 text-accent" />
      <h1 class="mt-3 text-[26px] font-semibold tracking-[-0.02em]">You're signed in</h1>
      <p class="mt-1.5 text-[15px] text-ink-soft">Go back to your terminal. You can close this page.</p>
    {:else if outcome === "denied"}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Sign-in refused</h1>
      <p class="mt-1.5 text-[15px] text-ink-soft">The terminal wasn't signed in. If you didn't start this, nothing else is needed.</p>
    {:else}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Sign in the schelf command?</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        It will act as <span class="text-ink">{session.account?.user.email}</span>. Check that the code matches the one in your terminal.
      </p>
      <input bind:value={code} aria-label="Code" autocomplete="off" spellcheck="false" class="field mt-6 h-14 text-center font-mono text-2xl tracking-[0.2em] uppercase" />
      {#if error}<p class="mt-3 text-[15px] text-danger" role="alert">{error}</p>{/if}
      <div class="mt-6 grid grid-cols-2 gap-2">
        <button type="button" class="button button-quiet" disabled={busy} onclick={() => decide(false)}>Refuse</button>
        <button type="button" class="button button-primary" disabled={busy || userCode.length < 6} onclick={() => decide(true)}>Sign it in</button>
      </div>
    {/if}
  </div>
</main>
