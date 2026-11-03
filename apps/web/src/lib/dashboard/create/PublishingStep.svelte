<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import Terminal from "@lucide/svelte/icons/terminal"
  import Upload from "@lucide/svelte/icons/upload"
  import Choice from "../../ui/fields/Choice.svelte"
  import Field from "../../ui/fields/Field.svelte"
  import GitHubMark from "../../ui/GitHubMark.svelte"
  import type { Draft } from "./draft.svelte.ts"

  let { draft }: { draft: Draft } = $props()
  const fields = $derived(draft.fields)
  const kind = $derived(draft.kind!)
  const listed = $derived(kind.store !== undefined && fields.visibility === "listed")
  let more = $state(false)
</script>

<div class="space-y-6">
  <div role="radiogroup" aria-label="How releases arrive" class="space-y-3">
    <Choice
      title="From GitHub Actions"
      text={listed
        ? "Publish a GitHub release and your workflow builds it and sends it to Schelf, with proof of where it was built."
        : "Publish a GitHub release and your workflow sends it to Schelf. It goes out as soon as the checks pass."}
      icon={GitHubMark}
      chosen={fields.publishing === "github"}
      onclick={() => (fields.publishing = "github")}
    />
    <Choice
      title={kind.uploads ? "Upload it yourself" : "From your computer"}
      text={kind.uploads
        ? "Built somewhere else? Upload the files here, or send them with schelf publish. A person reviews every upload."
        : "Send each release with schelf publish and a token. A person reviews every release sent this way."}
      icon={kind.uploads ? Upload : Terminal}
      chosen={fields.publishing === "hand"}
      onclick={() => (fields.publishing = "hand")}
    />
  </div>

  {#if fields.publishing === "github"}
    <Field label="GitHub repository" hint="owner/name. Private repositories work too.">
      <input class="field" bind:value={fields.repository} placeholder="lantharos/raffi" autocomplete="off" spellcheck="false" />
    </Field>
    <div>
      <button type="button" class="flex items-center gap-1.5 text-[15px] text-ink-soft hover:text-ink" aria-expanded={more} onclick={() => (more = !more)}>
        Workflow and environment
        <ChevronDown class="size-4 transition-transform {more ? 'rotate-180' : ''}" />
      </button>
      {#if more}
        <div class="mt-4 space-y-6">
          <Field label="Workflow file" hint="Only this workflow can publish. You can trust others later.">
            <input class="field font-mono text-[14px]" bind:value={fields.workflow} spellcheck="false" />
          </Field>
          <Field label="Environment" note="Optional" hint="Only jobs in this GitHub environment can publish, so you can require a click before each release.">
            <input class="field" bind:value={fields.environment} placeholder="release" spellcheck="false" />
          </Field>
        </div>
      {/if}
    </div>
  {/if}
</div>
