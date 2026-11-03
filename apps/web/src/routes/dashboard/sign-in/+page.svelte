<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import CodeField from "#lib/dashboard/account/CodeField.svelte"
  import { sendCode, signInWithCode, signInWithGitHub, signInWithPasskey } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Logo from "#lib/Logo.svelte"
  import GitHubMark from "#lib/ui/GitHubMark.svelte"
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"

  let email = $state("")
  let code = $state("")
  let sent = $state(false)
  let error = $state<string | null>(null)
  let busy = $state<"email" | "code" | "passkey" | "github" | null>(null)
  const next = $derived(page.url.searchParams.get("next") ?? "/dashboard")

  async function finish() {
    await session.load()
    await invalidateAll()
    await goto(next)
  }

  async function request(event?: SubmitEvent) {
    event?.preventDefault()
    busy = "email"
    error = await sendCode(email)
    busy = null
    if (!error) {
      sent = true
      code = ""
    }
  }

  async function verify(entered: string) {
    busy = "code"
    error = await signInWithCode(email, entered)
    busy = null
    if (error) code = ""
    else await finish()
  }

  async function passkey() {
    busy = "passkey"
    error = await signInWithPasskey()
    busy = null
    if (!error) await finish()
  }

  async function github() {
    busy = "github"
    await signInWithGitHub(`${location.origin}${next}`)
  }
</script>

<svelte:head><title>Sign in · Schelf for developers</title></svelte:head>

<main class="grid min-h-svh place-items-center px-4 py-12">
  <div class="enter w-full max-w-[22rem] text-center">
    <a href="/" aria-label="Schelf" class="inline-flex"><Logo class="size-10" /></a>
    {#if sent}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Check your email</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Enter the code we sent to <span class="text-ink">{email}</span>.</p>
      <div class="mt-7">
        <CodeField bind:value={code} oncomplete={verify} />
      </div>
      <p class="mt-3 h-5 text-[15px] {error ? 'text-danger' : 'text-ink-muted'}" role="status">
        {#if error}{error}{:else if busy === "code"}Checking…{/if}
      </p>
      <p class="mt-4 flex justify-center gap-5 text-[15px]">
        <button type="button" class="text-accent hover:underline" onclick={() => request()}>Send a new code</button>
        <button type="button" class="text-ink-muted hover:text-ink" onclick={() => ((sent = false), (error = null))}>Use another email</button>
      </p>
    {:else}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Publish on Schelf</h1>
      <p class="mt-1.5 text-[15px] text-ink-soft">Sign in or create your account.</p>

      <button type="button" class="button button-ink mt-8 w-full" disabled={busy !== null} onclick={github}>
        {#if busy === "github"}<LoaderCircle class="size-4 animate-spin" />{:else}<GitHubMark class="size-[18px]" />{/if}
        Continue with GitHub
      </button>

      <div class="my-6 flex items-center gap-3 text-[13px] text-ink-muted"><span class="h-px flex-1 bg-hairline"></span>or<span class="h-px flex-1 bg-hairline"></span></div>

      <form onsubmit={request} class="space-y-2.5">
        <input bind:value={email} type="email" required placeholder="you@example.com" aria-label="Email" autocomplete="email webauthn" class="field text-left" />
        <button class="button button-quiet w-full" disabled={busy !== null}>
          {#if busy === "email"}<LoaderCircle class="size-4 animate-spin" />{/if}
          Email me a code
        </button>
      </form>
      <button type="button" class="mx-auto mt-5 flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] text-ink-soft transition-colors hover:text-ink" disabled={busy !== null} onclick={passkey}>
        {#if busy === "passkey"}<LoaderCircle class="size-4 animate-spin" />{:else}<KeyRound class="size-4" />{/if}
        Use a passkey
      </button>
      {#if error}<p class="mt-4 text-[15px] text-danger" role="alert">{error}</p>{/if}

      <p class="mt-10 text-[13px] leading-relaxed text-ink-muted">
        By continuing you agree to the <a href="/legal/terms" class="link">terms</a> and
        <a href="/legal/privacy" class="link">privacy policy</a>.
      </p>
    {/if}
  </div>
</main>
