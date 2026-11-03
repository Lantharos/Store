<script lang="ts">
  import Code from "@lucide/svelte/icons/code"
  import Lock from "@lucide/svelte/icons/lock"
  import Choice from "../../ui/fields/Choice.svelte"
  import Field from "../../ui/fields/Field.svelte"
  import type { Draft } from "./draft.svelte.ts"

  let { draft }: { draft: Draft } = $props()
  const fields = $derived(draft.fields)
</script>

<div class="space-y-6">
  <div role="radiogroup" aria-label="Source" class="space-y-3">
    <Choice
      title="Open source"
      text="Its page links to the code, and Schelf checks each release against the source and its licence."
      icon={Code}
      chosen={fields.distribution === "open"}
      onclick={() => (fields.distribution = "open")}
    />
    <Choice
      title="Closed source"
      text="Its page says so, and each release is checked as a build, without looking at the code."
      icon={Lock}
      chosen={fields.distribution === "proprietary"}
      onclick={() => (fields.distribution = "proprietary")}
    />
  </div>
  {#if fields.distribution === "open"}
    <Field label="Licence" note="Optional" hint="As an SPDX id, like MIT or GPL-3.0-or-later.">
      <input class="field" bind:value={fields.licence} placeholder="MIT" spellcheck="false" autocomplete="off" />
    </Field>
  {/if}
</div>
