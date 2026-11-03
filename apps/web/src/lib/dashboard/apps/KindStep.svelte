<script lang="ts">
  import type { Format, Kind } from "@schelf/protocol"
  import Field from "../../ui/fields/Field.svelte"

  let {
    kind = $bindable(),
    format = $bindable(),
    name = $bindable(),
    summary = $bindable(),
  }: { kind: Kind; format: Format; name: string; summary: string } = $props()

  const CHOICES: { kind: Kind; format: Format; title: string; text: string }[] = [
    {
      kind: "app",
      format: "sabine",
      title: "A Sabine app",
      text: "Built for every system, with updates on Windows and macOS.",
    },
    { kind: "app", format: "appimage", title: "An AppImage", text: "Linux only. Runs in Luft's sandbox." },
    {
      kind: "extension",
      format: "luft-extension",
      title: "A Luft extension",
      text: "Adds to Luft's desktop.",
    },
  ]
</script>

<div class="space-y-6">
  <div role="radiogroup" aria-label="What you're publishing" class="grid gap-2 sm:grid-cols-3">
    {#each CHOICES as choice (choice.format)}
      {@const chosen = format === choice.format}
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        onclick={() => ((kind = choice.kind), (format = choice.format))}
        class="rounded-2xl p-4 text-left transition-[background-color,box-shadow] {chosen ? 'bg-raised shadow-[0_0_0_2px_var(--accent)]' : 'bg-well hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]'}"
      >
        <span class="block font-medium">{choice.title}</span>
        <span class="mt-1 block text-[13px] leading-relaxed text-ink-muted">{choice.text}</span>
      </button>
    {/each}
  </div>
  <Field label="Name" count={{ used: name.length, max: 60 }}>
    <input class="field" bind:value={name} maxlength="60" placeholder="Notes" />
  </Field>
  <Field label="Summary" hint="One line about what it does." count={{ used: summary.length, max: 120 }}>
    <input class="field" bind:value={summary} maxlength="120" placeholder="Plain-text notes, quickly" />
  </Field>
</div>
