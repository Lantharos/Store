<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import { type DashboardPublisher, updatePublisher } from "@schelf/protocol"
  import { untrack } from "svelte"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import DomainGroup from "#lib/dashboard/publishers/DomainGroup.svelte"
  import LogoField from "#lib/dashboard/publishers/LogoField.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import Group from "#lib/ui/group/Group.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"

  const publisher = $derived(session.publisher!)
  const editable = $derived(session.can("profile"))

  let form = $state(untrack(() => draftOf(session.publisher!)))
  let busy = $state(false)
  let error = $state<string | null>(null)

  $effect(() => {
    void publisher.id
    form = untrack(() => draftOf(publisher))
  })

  function draftOf(source: DashboardPublisher) {
    return {
      name: source.name,
      slug: source.slug,
      description: source.description,
      website: source.website ?? "",
    }
  }

  const changed = $derived(JSON.stringify(form) !== JSON.stringify(draftOf(publisher)))

  async function save(event: SubmitEvent) {
    event.preventDefault()
    const parsed = updatePublisher.safeParse({ ...form, website: form.website.trim() || null })
    if (!parsed.success) {
      error = parsed.error.issues[0]!.message
      return
    }
    busy = true
    error = null
    try {
      session.updatePublisher(
        await api.patch<DashboardPublisher>(endpoints.publisher(publisher.id), parsed.data),
      )
      toasts.show("Saved. The store shows it within a minute.")
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Profile" text="What people see on {publisher.name}'s page and next to its apps.">
  {#snippet actions()}
    <a href="/publishers/{publisher.slug}" target="_blank" class="button button-quiet">View page<ArrowUpRight class="size-4" /></a>
  {/snippet}
</PageHeader>

<form class="mt-8" onsubmit={save}>
  <Group>
    <LogoField {publisher} {editable} />
    <fieldset class="space-y-6" disabled={!editable}>
      <Field label="Name">
        <input bind:value={form.name} class="field" maxlength="80" required />
      </Field>
      <Field label="Address" hint="Changing it breaks links to the old address.">
        <div class="field flex items-center px-0 focus-within:shadow-[0_0_0_2px_var(--accent)]">
          <span class="shrink-0 pl-4 text-ink-muted">schelf.store/publishers/</span>
          <input bind:value={form.slug} class="h-full min-w-0 flex-1 bg-transparent pr-4 outline-none" maxlength="40" required spellcheck="false" aria-label="Address" />
        </div>
      </Field>
      <Field label="About" count={{ used: form.description.length, max: 240 }} hint="A sentence or two about who you are and what you make.">
        <textarea bind:value={form.description} class="field h-28 resize-y py-3 leading-relaxed" maxlength="240"></textarea>
      </Field>
      <Field label="Website">
        <input bind:value={form.website} class="field" type="url" placeholder="https://example.com" autocomplete="url" />
      </Field>
    </fieldset>
    {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
  </Group>
  {#if editable}<button class="button button-primary mt-5" disabled={!changed || busy}>Save</button>{/if}
</form>

{#key publisher.id}
  <div class="mt-12 max-w-3xl"><DomainGroup publisher={publisher.id} slug={publisher.slug} {editable} verified={publisher.verified} /></div>
{/key}
