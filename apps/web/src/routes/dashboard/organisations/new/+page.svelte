<script lang="ts">
  import { AGREEMENT_VERSION, type DashboardPublisher } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Agreement from "#lib/dashboard/publishers/Agreement.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import { goto } from "$app/navigation"

  let name = $state("")
  let agreed = $state(false)
  let busy = $state(false)
  let error = $state<string | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = null
    try {
      const created = await api.post<DashboardPublisher>(endpoints.publishers, {
        kind: "organisation",
        name,
        agreement: AGREEMENT_VERSION,
      })
      await session.refreshAccount()
      await session.use(created.id)
      await goto("/dashboard/members")
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="New organisation" text="An organisation publishes apps under its own name, with its own namespaces, members and public page. You'll be its owner." />

<form class="mt-8 max-w-[30rem] space-y-6" onsubmit={submit}>
  <Field label="Name" hint="Shown on its apps and its page on schelf.store. You can change it later.">
    <input bind:value={name} class="field" required maxlength="80" autocomplete="organization" />
  </Field>
  <Agreement bind:agreed on={name.trim() || "the organisation"} />
  {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
  <button class="button button-primary" disabled={!agreed || !name.trim() || busy}>Create organisation</button>
</form>
