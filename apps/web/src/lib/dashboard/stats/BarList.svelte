<script lang="ts">
  import { count } from "../../format.ts"

  let { rows, measure }: { rows: { label: string; value: number }[]; measure: string } = $props()
  const max = $derived(Math.max(...rows.map((row) => row.value), 1))
  const total = $derived(rows.reduce((sum, row) => sum + row.value, 0))
</script>

<ul class="space-y-3" aria-label={measure}>
  {#each rows as row (row.label)}
    <li class="group" title="{row.label}: {count(row.value)} {measure.toLowerCase()}">
      <p class="flex items-baseline justify-between gap-3 text-[15px]">
        <span class="truncate">{row.label}</span>
        <span class="tabular text-ink-soft">
          {count(row.value)}<span class="ml-2 inline-block w-10 text-right text-[13px] text-ink-muted">{total ? Math.round((row.value / total) * 100) : 0}%</span>
        </span>
      </p>
      <div class="mt-1.5 h-2 rounded-full bg-well">
        <div class="bar h-full rounded-full bg-series-1 transition-opacity group-hover:opacity-80" style:width="{(row.value / max) * 100}%"></div>
      </div>
    </li>
  {:else}
    <li class="text-[15px] text-ink-muted">Nothing yet.</li>
  {/each}
</ul>

<style>
  .bar {
    transition: width var(--spring-smooth-duration) var(--spring-smooth);
  }
</style>
