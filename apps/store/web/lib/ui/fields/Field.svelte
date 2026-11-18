<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    label,
    hint,
    error,
    count,
    note,
    children,
  }: {
    label: string
    hint?: string
    error?: string | null
    count?: { used: number; max: number }
    note?: string | null
    children: Snippet
  } = $props()
</script>

<div class="space-y-1.5">
  <div class="flex items-baseline justify-between gap-3">
    <span class="text-[15px] font-medium">
      {label}
      {#if note}<span class="ml-2 text-[13px] font-normal text-ink-muted">{note}</span>{/if}
    </span>
    {#if count}
      <span class="text-[13px] tabular {count.used > count.max ? 'text-danger' : 'text-ink-muted'}">{count.max - count.used}</span>
    {/if}
  </div>
  {@render children()}
  {#if error}
    <p class="text-[13px] text-danger">{error}</p>
  {:else if hint}
    <p class="text-[13px] leading-relaxed text-ink-muted">{hint}</p>
  {/if}
</div>
