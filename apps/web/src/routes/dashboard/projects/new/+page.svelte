<script lang="ts">
  import { type AppSettings, type CreateProject, createProject } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import Segmented from "#lib/ui/fields/Segmented.svelte"
  import { goto } from "$app/navigation"

  const publisher = $derived(session.publisher!)
  let name = $state("")
  let typedSlug = $state<string | null>(null)
  let distribution = $state<CreateProject["distribution"]>("open")
  let licence = $state("")
  let repository = $state("")
  let busy = $state(false)
  let error = $state<string | null>(null)

  const slugOf = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
  const slug = $derived(typedSlug ?? slugOf(name))

  async function create(event: SubmitEvent) {
    event.preventDefault()
    const parsed = createProject.safeParse({
      name,
      slug,
      distribution,
      licence: distribution === "open" ? licence.trim() || undefined : undefined,
      repository: repository.trim() || undefined,
    })
    if (!parsed.success) {
      error = parsed.error.issues[0]!.message
      return
    }
    busy = true
    error = null
    try {
      const created = await api.post<AppSettings>(endpoints.projects(publisher.id), parsed.data)
      await session.refreshApps()
      await goto(`/dashboard/apps/${created.app.id}/hosting`)
    } catch (failure) {
      error = (failure as Error).message
      busy = false
    }
  }
</script>

<PageHeader
  title="New project"
  text="Host your releases on Schelf and get download links and update feeds for them. Nobody finds it in the store unless you ask to list it later."
/>

<form class="mt-10 max-w-xl space-y-6" onsubmit={create}>
  <Field label="Name">
    <input class="field" bind:value={name} maxlength="60" placeholder="Raffi" required autocomplete="off" />
  </Field>
  <Field label="Address" hint="Your download links and page live here. You can change it later, which changes the links too.">
    <div class="field flex items-center font-mono text-[14px] focus-within:shadow-[0_0_0_2px_var(--accent)]">
      <span class="shrink-0 text-ink-muted">schelf.store/{publisher.slug}/</span>
      <input class="min-w-0 flex-1 bg-transparent outline-none" value={slug} oninput={(event) => (typedSlug = slugOf(event.currentTarget.value))} spellcheck="false" aria-label="Project address" />
    </div>
  </Field>
  <Field label="Source">
    <Segmented
      label="Source"
      bind:value={distribution}
      options={[
        { value: "open", label: "Open source" },
        { value: "proprietary", label: "Closed source" },
      ]}
    />
  </Field>
  {#if distribution === "open"}
    <Field label="Licence" hint="As an SPDX id. Schelf checks the source against it.">
      <input class="field" bind:value={licence} placeholder="MIT" spellcheck="false" />
    </Field>
  {:else}
    <p class="text-[15px] leading-relaxed text-ink-soft">The page says it's closed source, and each release is checked as a build, without looking at the code.</p>
  {/if}
  <Field label="GitHub repository" note="Optional" hint="owner/name. Shown on the page for open-source projects, and where trusted publishing starts from.">
    <input class="field" bind:value={repository} placeholder="lantharos/raffi" spellcheck="false" autocomplete="off" />
  </Field>
  {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
  <button class="button button-primary" disabled={busy || !name.trim() || !slug}>Create {name.trim() || "project"}</button>
  <p class="text-[13px] leading-relaxed text-ink-muted">Making a Sabine app, an AppImage or a Luft extension for the store? <a href="/dashboard/apps/new" class="link">Add it as an app</a> instead.</p>
</form>
