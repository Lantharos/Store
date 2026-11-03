<script lang="ts">
  import { AGREEMENT_VERSION, type DashboardPublisher } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Agreement from "#lib/dashboard/publishers/Agreement.svelte"
  import PendingInvites from "#lib/dashboard/publishers/PendingInvites.svelte"
  import Logo from "#lib/Logo.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import { goto } from "$app/navigation"

  let name = $state(session.account?.user.name ?? "")
  let agreed = $state(false)
  let busy = $state(false)
  let error = $state<string | null>(null)
  const invited = $derived((session.account?.invites.length ?? 0) > 0)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = null
    try {
      const created = await api.post<DashboardPublisher>(endpoints.publishers, {
        kind: "person",
        name,
        agreement: AGREEMENT_VERSION,
      })
      await session.refreshAccount()
      await session.use(created.id)
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
  <div class="enter w-full max-w-[26rem]">
    <Logo class="size-10" />
    {#if invited}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">You've been invited</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Join to work on their apps. You can publish your own as well.</p>
      <div class="mt-6"><PendingInvites /></div>
      <h2 class="mt-10 text-lg font-semibold">Or publish as yourself</h2>
    {:else}
      <h1 class="mt-6 text-[26px] font-semibold tracking-[-0.02em]">How should people know you?</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">This name is shown on your apps' pages. Publishing for a company or a team? Start with yourself, then create an organisation and invite the others.</p>
    {/if}

    <form class="mt-7 space-y-6" onsubmit={submit}>
      <Field label="Your name">
        <input bind:value={name} class="field" required maxlength="80" autocomplete="name" />
      </Field>
      <Agreement bind:agreed />
      {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
      <button class="button button-primary w-full" disabled={!agreed || !name.trim() || busy}>Continue</button>
    </form>
    <button type="button" class="mt-3 w-full text-[15px] text-ink-muted hover:text-ink" onclick={() => session.signOut().then(() => goto("/"))}>Sign out</button>
  </div>
</main>
