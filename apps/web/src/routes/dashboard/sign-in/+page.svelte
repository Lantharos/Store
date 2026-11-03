<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import CodeField from "#lib/dashboard/account/CodeField.svelte"
  import { sendCode, signInWithCode, signInWithGitHub, signInWithPasskey } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Logo from "#lib/Logo.svelte"
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
  <div class="enter w-full max-w-[22rem]">
    <a href="/" aria-label="Schelf"><Logo class="size-10" /></a>
    {#if sent}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Check your email</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Enter the code we sent to <span class="text-ink">{email}</span>.</p>
      <div class="mt-6">
        <CodeField bind:value={code} oncomplete={verify} />
      </div>
      <p class="mt-3 h-5 text-[15px] {error ? 'text-danger' : 'text-ink-muted'}" role="status">
        {#if error}{error}{:else if busy === "code"}Checking…{/if}
      </p>
      <p class="mt-4 flex gap-5 text-[15px]">
        <button type="button" class="text-accent hover:underline" onclick={() => request()}>Send a new code</button>
        <button type="button" class="text-ink-muted hover:text-ink" onclick={() => ((sent = false), (error = null))}>Use another email</button>
      </p>
    {:else}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">Publish on Schelf</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Put your apps and Luft extensions in front of people on Luft, Linux, Windows and macOS. Releases are built in your own GitHub workflow and checked by a person before anyone gets them. Signing in for the first time creates your account.</p>

      <button type="button" class="button button-ink mt-7 w-full" disabled={busy !== null} onclick={github}>
        {#if busy === "github"}
          <LoaderCircle class="size-4 animate-spin" />
        {:else}
          <svg viewBox="0 0 16 16" class="size-[18px]" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
        {/if}
        Continue with GitHub
      </button>
      <p class="mt-2 text-[13px] leading-relaxed text-ink-muted">Also proves <span class="font-mono">io.github.</span>your name, so you can publish right away.</p>

      <div class="my-6 flex items-center gap-3 text-[13px] text-ink-muted"><span class="h-px flex-1 bg-hairline"></span>or<span class="h-px flex-1 bg-hairline"></span></div>

      <form onsubmit={request} class="space-y-2.5">
        <input bind:value={email} type="email" required placeholder="you@example.com" aria-label="Email" autocomplete="email webauthn" class="field" />
        <button class="button button-quiet w-full" disabled={busy !== null}>
          {#if busy === "email"}<LoaderCircle class="size-4 animate-spin" />{/if}
          Email me a code
        </button>
      </form>
      <button type="button" class="mt-4 flex items-center gap-2 text-[15px] text-ink-soft hover:text-ink" onclick={passkey}>
        <KeyRound class="size-4" />
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
