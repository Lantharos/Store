<script lang="ts">
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

<div role="radiogroup" aria-label="Appearance" class="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
  {#each OPTIONS as option (option.value)}
    {@const chosen = scheme.value === option.value}
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onclick={() => scheme.set(option.value)}
      class="flex flex-col items-start gap-3 rounded-2xl p-4 text-left transition-colors {chosen ? 'bg-well shadow-[0_0_0_2px_var(--accent)]' : 'bg-well/50 hover:bg-well'}"
    >
      <option.icon class="size-5 {chosen ? 'text-accent' : 'text-ink-muted'}" />
      <span>
        <span class="block font-medium">{option.label}</span>
        <span class="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">{option.text}</span>
      </span>
    </button>
  {/each}
</div>
