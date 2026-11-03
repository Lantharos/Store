<script lang="ts">
  import type { Stats } from "@schelf/protocol"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import BarList from "#lib/dashboard/stats/BarList.svelte"
  import DailyChart from "#lib/dashboard/stats/DailyChart.svelte"
  import { count } from "#lib/format.ts"
  import { PLATFORM_NAMES } from "#lib/system/artifacts.ts"
  import Segmented from "#lib/ui/fields/Segmented.svelte"
  import { page } from "$app/state"

  const id = $derived(page.params.id!)
  const settings = $derived(appSettings()())
  let days = $state(30)
  let measure = $state<"installs" | "updates">("installs")
  let table = $state(false)
  const stats = $derived(resource<Stats>(endpoints.stats(id, days)))
  const data = $derived(stats.data)
  const dayLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" })
</script>

<svelte:head><title>Stats · {settings.data!.app.name} · Schelf for developers</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
  <Segmented bind:value={days} label="Period" options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} />
  <button type="button" class="text-[15px] text-accent hover:underline" onclick={() => (table = !table)}>{table ? "Show the chart" : "Show as a table"}</button>
</div>

{#if stats.error}
  <div class="mt-6"><Failed error={stats.error} retry={() => stats.refresh()} /></div>
{:else if !data}
  <div class="mt-6 grid gap-4 sm:grid-cols-2"><div class="placeholder h-24"></div><div class="placeholder h-24"></div></div>
  <div class="placeholder mt-6 h-72"></div>
{:else}
  <dl class="mt-8 grid grid-cols-2 gap-6 rounded-group bg-raised p-5 transition-opacity sm:grid-cols-4 sm:p-7" class:opacity-60={stats.loading}>
    <div><dt class="text-[13px] text-ink-muted">Installs</dt><dd class="mt-1 text-[28px] font-semibold tabular">{count(data.total.installs)}</dd></div>
    <div><dt class="text-[13px] text-ink-muted">Updates</dt><dd class="mt-1 text-[28px] font-semibold tabular">{count(data.total.updates)}</dd></div>
    <div><dt class="text-[13px] text-ink-muted">Busiest day</dt><dd class="mt-1 text-[28px] font-semibold tabular">{count(Math.max(0, ...data.days.map((day) => day.installs)))}</dd></div>
    <div><dt class="text-[13px] text-ink-muted">On {data.versions[0]?.version ?? "the latest"}</dt><dd class="mt-1 text-[28px] font-semibold tabular">{count((data.versions[0]?.installs ?? 0) + (data.versions[0]?.updates ?? 0))}</dd></div>
  </dl>

  <section class="mt-8 rounded-group bg-raised p-5 sm:p-7">
    <h2 class="font-semibold">By day</h2>
    <div class="mt-4">
      {#if table}
        <div class="max-h-96 overflow-y-auto">
          <table class="w-full text-[15px] tabular">
            <thead class="sticky top-0 bg-raised text-left text-[13px] text-ink-muted"><tr><th class="py-2 font-normal">Day</th><th class="py-2 text-right font-normal">Installs</th><th class="py-2 text-right font-normal">Updates</th></tr></thead>
            <tbody class="divide-y divide-hairline">
              {#each [...data.days].reverse() as day (day.day)}
                <tr><td class="py-2">{dayLabel.format(new Date(`${day.day}T00:00:00Z`))}</td><td class="py-2 text-right">{count(day.installs)}</td><td class="py-2 text-right">{count(day.updates)}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <DailyChart days={data.days} />
      {/if}
    </div>
  </section>

  <div class="mt-10 flex items-center justify-between gap-3 px-1">
    <h2 class="font-semibold">Where they are</h2>
    <Segmented bind:value={measure} label="Measure" size="sm" options={[{ value: "installs", label: "Installs" }, { value: "updates", label: "Updates" }]} />
  </div>
  <div class="mt-4 grid gap-6 lg:grid-cols-2">
    <section class="rounded-group bg-raised p-5 sm:p-7">
      <h3 class="mb-5 text-[15px] text-ink-muted">By version</h3>
      <BarList measure={measure === "installs" ? "Installs" : "Updates"} rows={data.versions.map((row) => ({ label: row.version, value: row[measure] }))} />
    </section>
    <section class="rounded-group bg-raised p-5 sm:p-7">
      <h3 class="mb-5 text-[15px] text-ink-muted">By system</h3>
      <BarList measure={measure === "installs" ? "Installs" : "Updates"} rows={data.platforms.map((row) => ({ label: PLATFORM_NAMES[row.platform], value: row[measure] })).sort((a, b) => b.value - a.value)} />
    </section>
  </div>
  <p class="mt-4 px-1 text-[13px] text-ink-muted">Counted from downloads, a day at a time. Schelf keeps nothing about who installed it.</p>
{/if}
