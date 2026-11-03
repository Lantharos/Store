<script lang="ts">
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    stops = [],
    label,
    format = (value: number) => String(value),
  }: {
    value?: number
    min?: number
    max?: number
    step?: number
    stops?: number[]
    label: string
    format?: (value: number) => string
  } = $props()

  let track = $state<HTMLElement>()
  const fraction = $derived((value - min) / (max - min))

  function clamp(next: number) {
    return Math.min(max, Math.max(min, Math.round(next / step) * step))
  }

  function fromPointer(event: PointerEvent) {
    const rect = track!.getBoundingClientRect()
    value = clamp(min + ((event.clientX - rect.left) / rect.width) * (max - min))
  }

  function down(event: PointerEvent) {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    fromPointer(event)
  }

  function keydown(event: KeyboardEvent) {
    const big = (max - min) / 10
    const moves: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    value = clamp(moves[event.key]!)
  }
</script>

<div class="select-none">
  <div
    bind:this={track}
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-valuetext={format(value)}
    onpointerdown={down}
    onpointermove={(event) => event.buttons === 1 && fromPointer(event)}
    onkeydown={keydown}
    class="group relative flex h-8 cursor-pointer touch-none items-center rounded-full outline-offset-4"
  >
    <span class="absolute inset-x-0 h-2 rounded-full bg-well"></span>
    <span class="absolute left-0 h-2 rounded-full bg-accent" style:width="{fraction * 100}%"></span>
    {#each stops as stop (stop)}
      <span class="absolute size-1.5 -translate-x-1/2 rounded-full bg-raised/80" style:left="{((stop - min) / (max - min)) * 100}%"></span>
    {/each}
    <span
      class="absolute size-6 -translate-x-1/2 rounded-full bg-raised shadow-[0_1px_4px_rgb(0_0_0/0.25)] ring-1 ring-hairline transition-transform group-active:scale-110"
      style:left="{fraction * 100}%"
    ></span>
  </div>
  {#if stops.length}
    <div class="relative mt-1 h-5 text-[13px] text-ink-muted">
      {#each stops as stop (stop)}
        <button type="button" class="absolute -translate-x-1/2 hover:text-ink" style:left="{((stop - min) / (max - min)) * 100}%" onclick={() => (value = stop)}>{format(stop)}</button>
      {/each}
    </div>
  {/if}
</div>
