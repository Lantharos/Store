<script lang="ts" generics="T extends string | number">
  import type { Component } from "svelte"

  let {
    value = $bindable(),
    options,
    label,
    size = "md",
    onchange,
  }: {
    value: T
    options: { value: T; label: string; icon?: Component<{ class?: string }> }[]
    label: string
    size?: "sm" | "md"
    onchange?: (value: T) => void
  } = $props()

  const selected = $derived(Math.max(0, options.findIndex((option) => option.value === value)))

  function choose(next: T) {
    value = next
    onchange?.(next)
  }

  function keydown(event: KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = options[(selected + step + options.length) % options.length]!
    choose(next.value)
    ;(event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-index="${options.indexOf(next)}"]`)?.focus()
  }
</script>

<div
  role="radiogroup"
  aria-label={label}
  tabindex="-1"
  onkeydown={keydown}
  class="relative inline-grid rounded-full bg-well p-1"
  style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))"
>
  <span
    aria-hidden="true"
    class="thumb absolute inset-y-1 left-1 rounded-full bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
    style:width="calc((100% - 0.5rem) / {options.length})"
    style:translate="{selected * 100}% 0"
  ></span>
  {#each options as option, index (option.value)}
    <button
      type="button"
      role="radio"
      data-index={index}
      aria-checked={index === selected}
      tabindex={index === selected ? 0 : -1}
      onclick={() => choose(option.value)}
      class="relative z-10 flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors {size === 'sm'
        ? 'h-7 px-3 text-[13px]'
        : 'h-8 px-4 text-sm'} {index === selected ? 'text-ink' : 'text-ink-muted hover:text-ink'}"
    >
      {#if option.icon}<option.icon class="size-4" />{/if}
      {option.label}
    </button>
  {/each}
</div>

<style>
  .thumb {
    transition: translate var(--spring-snappy-duration) var(--spring-snappy);
  }
</style>
