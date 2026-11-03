<script lang="ts">
  import { type AppSettings, type CreateApp, createApp, type Namespace } from "@schelf/protocol"
  import CodeBlock from "#lib/code/CodeBlock.svelte"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import IdStep from "#lib/dashboard/apps/IdStep.svelte"
  import KindStep from "#lib/dashboard/apps/KindStep.svelte"
  import SetupFiles from "#lib/dashboard/apps/SetupFiles.svelte"
  import Steps from "#lib/dashboard/apps/Steps.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Field from "#lib/ui/fields/Field.svelte"

  const STEPS = ["What it is", "Its id", "Where it's built", "Commit the files"]
  const namespaces = resource<Namespace[]>(endpoints.namespaces)
  const github = session.account?.github

  let step = $state(0)
  let idReady = $state(false)
  let busy = $state(false)
  let error = $state<string | null>(null)
  let created = $state<AppSettings | null>(null)
  let form = $state<CreateApp>({
    kind: "app",
    format: "sabine",
    name: "",
    summary: "",
    id: "",
    repository: "",
    workflow: ".github/workflows/schelf.yml",
    environment: undefined,
  })

  const slug = (name: string) => name.replace(/[^A-Za-z0-9]+/g, "")

  function next() {
    if (step === 0 && !form.id && github) form.id = `io.github.${github}.${slug(form.name)}`
    if (step === 1 && !form.repository && github)
      form.repository = `${github}/${slug(form.name).toLowerCase()}`
    step += 1
  }

  async function create(event: SubmitEvent) {
    event.preventDefault()
    const parsed = createApp.safeParse({ ...form, environment: form.environment?.trim() || undefined })
    if (!parsed.success) {
      error = parsed.error.issues[0]!.message
      return
    }
    busy = true
    error = null
    try {
      created = await api.post<AppSettings>(endpoints.apps, parsed.data)
      await session.refreshApps()
      step = 3
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Add an app" text="A few minutes now, and every release after this is a GitHub release." />

<div class="mt-8"><Steps steps={STEPS} current={step} /></div>

<div class="mt-10 max-w-2xl">
  {#key step}
    <div class="enter">
      {#if step === 0}
        <KindStep bind:kind={form.kind} bind:format={form.format} bind:name={form.name} bind:summary={form.summary} />
        <button type="button" class="button button-primary mt-8" disabled={!form.name.trim() || !form.summary.trim()} onclick={next}>Continue</button>
      {:else if step === 1}
        <IdStep bind:id={form.id} {namespaces} bind:ready={idReady} />
        <div class="mt-8 flex gap-2">
          <button type="button" class="button button-quiet" onclick={() => (step = 0)}>Back</button>
          <button type="button" class="button button-primary" disabled={!idReady} onclick={next}>Continue</button>
        </div>
      {:else if step === 2}
        <form class="space-y-6" onsubmit={create}>
          <p class="text-[15px] leading-relaxed text-ink-soft">Only this workflow will be able to publish {form.name}. You can add others later.</p>
          <Field label="GitHub repository" hint="owner/name. Private repositories work too.">
            <input class="field" bind:value={form.repository} placeholder="alice/notes" required autocomplete="off" spellcheck="false" />
          </Field>
          <Field label="Workflow file">
            <input class="field font-mono text-[14px]" bind:value={form.workflow} required spellcheck="false" />
          </Field>
          <Field label="Environment" hint="Optional. Only jobs in this GitHub environment can publish, so you can require a click before each release.">
            <input class="field" bind:value={form.environment} placeholder="release" />
          </Field>
          {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
          <div class="flex gap-2">
            <button type="button" class="button button-quiet" onclick={() => (step = 1)}>Back</button>
            <button class="button button-primary" disabled={busy}>Create {form.name}</button>
          </div>
        </form>
      {:else if created}
        <h2 class="text-xl font-semibold">{created.app.name} is ready for its first release</h2>
        <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">Commit these two files to <span class="font-mono text-[13px]">{form.repository}</span>, then publish a GitHub release.</p>
        <div class="mt-6"><SetupFiles setup={created.setup} /></div>
        <p class="mt-8 text-[15px] text-ink-soft">Or, in the repository, let the command write them:</p>
        <div class="mt-3"><CodeBlock lang="sh" code="bunx schelf init" /></div>
        <a href="/dashboard/apps/{created.app.id}/listing" class="button button-primary mt-8">Fill in the listing</a>
      {/if}
    </div>
  {/key}
</div>
