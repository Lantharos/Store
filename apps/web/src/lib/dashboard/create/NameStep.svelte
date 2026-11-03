<script lang="ts">
  import Field from "../../ui/fields/Field.svelte"
  import { type Draft, slugOf } from "./draft.svelte.ts"

  let { draft, publisher }: { draft: Draft; publisher: string } = $props()
  const fields = $derived(draft.fields)
</script>

<div class="space-y-6">
  <Field label="Name" count={{ used: fields.name.length, max: 60 }}>
    <input class="field" bind:value={fields.name} maxlength="60" placeholder="Raffi" autocomplete="off" />
  </Field>
  <Field label="Summary" note="Optional" hint="One line about what it does. It shows under the name." count={{ used: fields.summary.length, max: 120 }}>
    <input class="field" bind:value={fields.summary} maxlength="120" placeholder="A calm music player for your own library" autocomplete="off" />
  </Field>
  {#if !draft.kind?.store}
    <Field label="Address" hint="Its page and download links live here. You can change it later.">
      <div class="field flex items-center font-mono text-[14px] focus-within:shadow-[0_0_0_2px_var(--accent)]">
        <span class="shrink-0 text-ink-muted">schelf.store/{publisher}/</span>
        <input class="min-w-0 flex-1 bg-transparent outline-none" value={draft.slug} oninput={(event) => (fields.typedSlug = slugOf(event.currentTarget.value))} spellcheck="false" aria-label="Address" />
      </div>
    </Field>
    <p class="text-[15px] leading-relaxed text-ink-soft">
      It starts unlisted: anyone with the link can download it, but it won't show up in the store or in search. You can ask to list it once it's out.
    </p>
  {/if}
</div>
