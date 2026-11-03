<script lang="ts">
  import { AGREEMENT_VERSION, type Developer } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Logo from "#lib/Logo.svelte"
  import Checkbox from "#lib/ui/fields/Checkbox.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import Segmented from "#lib/ui/fields/Segmented.svelte"
  import { goto } from "$app/navigation"

  let name = $state(session.account?.user.name ?? "")
  let kind = $state<"person" | "organisation">("person")
  let agreed = $state(false)
  let busy = $state(false)
  let error = $state<string | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = null
    try {
      await api.post<Developer>(endpoints.account, { name, kind, agreement: AGREEMENT_VERSION })
      await session.load()
      await goto("/dashboard/apps/new")
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }
</script>

<svelte:head><title>Welcome · Schelf for developers</title></svelte:head>

<main class="grid min-h-svh place-items-center px-4 py-12">
  <form class="enter w-full max-w-[26rem]" onsubmit={submit}>
    <Logo class="size-10" />
    <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">How should people know you?</h1>
    <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">This name is shown on your apps' pages. You can change it later.</p>

    <div class="mt-7 space-y-6">
      <Field label="Publishing as">
        <Segmented bind:value={kind} label="Publishing as" options={[{ value: "person", label: "Myself" }, { value: "organisation", label: "An organisation" }]} />
      </Field>
      <Field label={kind === "person" ? "Your name" : "Organisation name"}>
        <input bind:value={name} class="field" required maxlength="80" autocomplete={kind === "person" ? "name" : "organization"} />
      </Field>
      <div class="rounded-2xl bg-well p-4 text-[15px] leading-relaxed text-ink-soft">
        <p>In short, you agree that:</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>you own what you publish, and its licence is true;</li>
          <li>you'll tell us within 72 hours if your account is compromised;</li>
          <li>Schelf may host, check, sign and, when it's harmful, stop your app.</li>
        </ul>
      </div>
      <Checkbox bind:checked={agreed}>
        I accept the <a href="/legal/developer-agreement" target="_blank" class="link">developer agreement</a>
      </Checkbox>
    </div>

    {#if error}<p class="mt-4 text-[15px] text-danger" role="alert">{error}</p>{/if}
    <button class="button button-primary mt-8 w-full" disabled={!agreed || !name.trim() || busy}>Continue</button>
    <button type="button" class="mt-3 w-full text-[15px] text-ink-muted hover:text-ink" onclick={() => session.signOut().then(() => goto("/"))}>Sign out</button>
  </form>
</main>
