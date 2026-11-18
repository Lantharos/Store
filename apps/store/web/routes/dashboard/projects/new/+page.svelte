<script lang="ts">
  import type { AppSettings, Namespace } from "@schelf/protocol"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { Draft } from "#lib/dashboard/create/draft.svelte.ts"
  import IdStep from "#lib/dashboard/create/IdStep.svelte"
  import KindStep from "#lib/dashboard/create/KindStep.svelte"
  import NameStep from "#lib/dashboard/create/NameStep.svelte"
  import Progress from "#lib/dashboard/create/Progress.svelte"
  import PublishingStep from "#lib/dashboard/create/PublishingStep.svelte"
  import SourceStep from "#lib/dashboard/create/SourceStep.svelte"
  import VisibilityStep from "#lib/dashboard/create/VisibilityStep.svelte"
  import FirstRelease from "#lib/dashboard/overview/FirstRelease.svelte"
  import { Task } from "#lib/ui/overlay/task.svelte.ts"

  const publisher = $derived(session.publisher!)
  const draft = $derived(new Draft(publisher.id))
  const namespaces = $derived(resource<Namespace[]>(endpoints.namespaces(publisher.id)))
  const fields = $derived(draft.fields)
  const save = new Task({ inline: true })
  let created = $state<AppSettings | null>(null)

  $effect(() => {
    if (!created) draft.save()
  })

  const HEADINGS = {
    kind: "What are you making?",
    name: "What's it called?",
    id: "Its app id",
    visibility: "Who should find it?",
    source: "Is the code open?",
    publishing: "How will releases arrive?",
    finish: "",
  }
  const heading = $derived(
    draft.current === "finish"
      ? `${created?.app.name ?? fields.name} is ready for its first release`
      : HEADINGS[draft.current],
  )
  const lead = $derived(
    {
      kind: "Schelf asks only what that kind of project needs.",
      name: null,
      id: null,
      visibility: null,
      source: null,
      publishing: "You can add the other way later.",
      finish: "It takes a few minutes, and every release after this works the same way.",
    }[draft.current],
  )
  const last = $derived(draft.steps.indexOf("finish") - 1 === fields.step)
  const ready = $derived(
    {
      kind: false,
      name: fields.name.trim() !== "" && (draft.kind?.store !== undefined || draft.slug !== ""),
      id: draft.idReady(namespaces.data ?? []),
      visibility: true,
      source: true,
      publishing: fields.publishing === "hand" || fields.repository.trim() !== "",
      finish: false,
    }[draft.current],
  )

  async function next(event: SubmitEvent) {
    event.preventDefault()
    if (!ready) return
    save.error = null
    if (!last) {
      draft.go(fields.step + 1)
      draft.fillDefaults(session.account?.github ?? undefined)
      return
    }
    await save.run(async () => {
      created = await draft.create(publisher.id)
      draft.forget()
      draft.go(fields.step + 1)
      await session.refreshApps()
    })
  }
</script>

<svelte:head><title>New project · Schelf for developers</title></svelte:head>

<form class="mx-auto max-w-2xl pb-16" onsubmit={next}>
  <Progress steps={draft.steps} current={fields.step} />

  {#key draft.current}
    <div class="enter mt-10">
      <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{heading}</h1>
      {#if lead}<p class="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">{lead}</p>{/if}

      <div class="mt-8">
        {#if draft.current === "kind"}
          <KindStep chosen={fields.kind} onchoose={(kind) => draft.choose(kind)} />
        {:else if draft.current === "name"}
          <NameStep {draft} publisher={publisher.slug} />
        {:else if draft.current === "id"}
          <IdStep bind:id={fields.id} {namespaces} optional={!draft.kind?.store} />
        {:else if draft.current === "visibility"}
          <VisibilityStep bind:visibility={fields.visibility} />
        {:else if draft.current === "source"}
          <SourceStep {draft} />
        {:else if draft.current === "publishing"}
          <PublishingStep {draft} />
        {:else if created}
          <FirstRelease settings={created} />
        {/if}
      </div>
    </div>
  {/key}

  {#if save.error}<p class="mt-6 text-[15px] text-danger" role="alert">{save.error}</p>{/if}

  <div class="mt-10 flex flex-wrap items-center gap-2">
    {#if created}
      <a href="/dashboard/apps/{created.app.id}" class="button button-primary">Go to {created.app.name}</a>
      <a href="/dashboard/apps/{created.app.id}/listing" class="button button-quiet">Fill in the listing</a>
    {:else if draft.current !== "kind"}
      <button type="button" class="button button-quiet" onclick={() => draft.go(fields.step - 1)}>Back</button>
      <button class="button button-primary" disabled={!ready || save.busy}>{last ? `Create ${fields.name.trim()}` : "Continue"}</button>
    {:else if draft.started}
      <button type="button" class="ml-auto text-[15px] text-ink-muted hover:text-ink" onclick={() => draft.reset()}>Start over</button>
    {/if}
  </div>
</form>
