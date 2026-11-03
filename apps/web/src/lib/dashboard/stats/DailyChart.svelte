<script lang="ts">
  import type { Stats } from "@schelf/protocol"
  import { count, shortCount } from "../../format.ts"
  import { niceMax, smoothPath, ticks } from "./scale.ts"

  let { days }: { days: Stats["days"] } = $props()

  const SERIES = [
    { key: "installs", label: "Installs", color: "var(--series-1)" },
    { key: "updates", label: "Updates", color: "var(--series-2)" },
  ] as const
  const HEIGHT = 240
  const PAD = { top: 12, right: 12, bottom: 28, left: 44 }

  let width = $state(640)
  let active = $state<number | null>(null)
  const plotWidth = $derived(Math.max(1, width - PAD.left - PAD.right))
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const max = $derived(niceMax(Math.max(...days.flatMap((day) => [day.installs, day.updates]), 0)))
  const x = (index: number) =>
    PAD.left + (days.length > 1 ? (index / (days.length - 1)) * plotWidth : plotWidth / 2)
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  const label = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })
  const dayLabel = (day: string) => label.format(new Date(`${day}T00:00:00Z`))
  const xTicks = $derived(days.length ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [])
  const point = $derived(active === null ? null : days[active])

  function pointer(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const fraction = (event.clientX - rect.left - PAD.left) / plotWidth
    active = Math.min(days.length - 1, Math.max(0, Math.round(fraction * (days.length - 1))))
  }

  function keydown(event: KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    event.preventDefault()
    active = Math.min(days.length - 1, Math.max(0, (active ?? days.length - 1) + step))
  }
</script>

<figure>
  <figcaption class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-soft">
    {#each SERIES as series (series.key)}
      <span class="flex items-center gap-2"><span class="h-0.5 w-4 rounded-full" style:background={series.color}></span>{series.label}</span>
    {/each}
  </figcaption>
  <div
    class="relative mt-3 touch-pan-y rounded-lg"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label="Installs and updates per day. Use the arrow keys to read each day."
    aria-valuemin={0}
    aria-valuemax={Math.max(0, days.length - 1)}
    aria-valuenow={active ?? days.length - 1}
    aria-valuetext={point ? `${dayLabel(point.day)}: ${count(point.installs)} installs, ${count(point.updates)} updates` : undefined}
    onpointermove={pointer}
    onpointerleave={() => (active = null)}
    onkeydown={keydown}
    onblur={() => (active = null)}
  >
    <svg {width} height={HEIGHT} aria-hidden="true" class="block overflow-visible">
      {#each ticks(max) as tick (tick)}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--hairline)" />
        <text x={PAD.left - 8} y={y(tick)} dy="0.32em" text-anchor="end" class="fill-ink-muted text-[11px] tabular">{shortCount(tick)}</text>
      {/each}
      {#each xTicks as index (index)}
        <text x={x(index)} y={HEIGHT - 8} text-anchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"} class="fill-ink-muted text-[11px]">{dayLabel(days[index]!.day)}</text>
      {/each}
      {#each SERIES as series (series.key)}
        <path d={smoothPath(days.map((day, index) => [x(index), y(day[series.key])]))} fill="none" stroke={series.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="line" />
      {/each}
      {#if point && active !== null}
        <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--ink-muted)" stroke-dasharray="2 3" />
        {#each SERIES as series (series.key)}
          <circle cx={x(active)} cy={y(point[series.key])} r="4.5" fill={series.color} stroke="var(--raised)" stroke-width="2" />
        {/each}
      {/if}
    </svg>
    {#if point && active !== null}
      <div
        class="pointer-events-none absolute top-0 z-10 w-40 rounded-xl bg-raised p-3 text-[13px] shadow-float ring-1 ring-hairline"
        style:left="{Math.min(Math.max(x(active) - 80, 0), width - 160)}px"
        style:translate="0 -100%"
        role="status"
      >
        <p class="font-medium">{dayLabel(point.day)}</p>
        {#each SERIES as series (series.key)}
          <p class="mt-1 flex items-center justify-between gap-3 text-ink-soft">
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" style:background={series.color}></span>{series.label}</span>
            <span class="text-ink tabular">{count(point[series.key])}</span>
          </p>
        {/each}
      </div>
    {/if}
  </div>
</figure>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .line {
      stroke-dasharray: 4000;
      animation: draw 900ms var(--ease-decelerate) both;
    }
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 4000;
    }
  }
</style>
