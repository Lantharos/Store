<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import Monitor from "@lucide/svelte/icons/monitor"
  import Moon from "@lucide/svelte/icons/moon"
  import Sun from "@lucide/svelte/icons/sun"
  import { onMount } from "svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import { type Scheme, scheme } from "#lib/theme/scheme.svelte.ts"

  onMount(() => scheme.load())

  const OPTIONS: { value: Scheme; label: string; text: string; icon: typeof Sun }[] = [
    {
      value: "system",
      label: "Match the system",
      text: "Light or dark, following your computer.",
      icon: Monitor,
    },
    { value: "light", label: "Light", text: "Warm and bright, always.", icon: Sun },
    { value: "dark", label: "Dark", text: "Easy on the eyes at night.", icon: Moon },
  ]
</script>

<PageHeader title="Appearance" text="How schelf.store and the dashboard look in this browser." />

<div role="radiogroup" aria-label="Appearance" class="mt-8 divide-y divide-hairline overflow-hidden rounded-group bg-raised">
  {#each OPTIONS as option (option.value)}
    {@const chosen = scheme.value === option.value}
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onclick={() => scheme.set(option.value)}
      class="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-well/50"
    >
      <option.icon class="size-5 shrink-0 {chosen ? 'text-accent' : 'text-ink-muted'}" />
      <span class="min-w-0 flex-1">
        <span class="block font-medium">{option.label}</span>
        <span class="block text-[13px] leading-relaxed text-ink-muted">{option.text}</span>
      </span>
      <span class="grid size-5 shrink-0 place-items-center rounded-full {chosen ? 'bg-accent text-accent-ink' : 'shadow-[inset_0_0_0_1.5px_var(--hairline)]'}">
        {#if chosen}<Check class="size-3.5" strokeWidth={3} />{/if}
      </span>
    </button>
  {/each}
</div>
