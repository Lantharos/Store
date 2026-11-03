<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import type { Snippet } from "svelte"

  let {
    checked = $bindable(false),
    children,
  }: { checked?: boolean; children: Snippet } = $props()
</script>

<label class="group flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onclick={() => (checked = !checked)}
    class="mt-px grid size-5 shrink-0 place-items-center rounded-md transition-colors {checked
      ? 'bg-accent text-accent-ink'
      : 'bg-well group-hover:bg-[color-mix(in_oklab,var(--well)_80%,var(--ink))]'}"
  >
    {#if checked}<Check class="size-3.5" strokeWidth={3} />{/if}
  </button>
  <span>{@render children()}</span>
</label>
