<script lang="ts" generics="T extends string">
  import type { Component } from "svelte"

  interface Option {
    value: T
    title: string
    text: string
    icon?: Component<{ class?: string }>
  }

  let {
    value = $bindable(),
    options,
    label,
    compact = false,
    followFocus = true,
    class: className = "space-y-3",
    onchange,
  }: {
    value?: T | null
    options: readonly Option[]
    label: string
    compact?: boolean
    followFocus?: boolean
    class?: string
    onchange?: (value: T) => void
  } = $props()

  const buttons: HTMLButtonElement[] = []
  const focusable = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  )
  const STEPS: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

  function choose(next: T) {
    value = next
    onchange?.(next)
  }

  function target(key: string, index: number) {
    if (key === "Home") return 0
    if (key === "End") return options.length - 1
    if (key in STEPS) return (index + STEPS[key]! + options.length) % options.length
    return null
  }

  function keydown(event: KeyboardEvent, index: number) {
    const next = target(event.key, index)
    if (next === null) return
    event.preventDefault()
    buttons[next]!.focus()
    if (followFocus) choose(options[next]!.value)
  }
</script>

<div role="radiogroup" aria-label={label} class={className}>
  {#each options as option, index (option.value)}
    {@const chosen = option.value === value}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      aria-checked={chosen}
      tabindex={index === focusable ? 0 : -1}
      onclick={() => choose(option.value)}
      onkeydown={(event) => keydown(event, index)}
      class="group flex w-full items-start gap-4 rounded-group bg-raised text-left transition-[box-shadow,background-color] hover:bg-[color-mix(in_oklab,var(--raised)_94%,var(--ink))] {compact ? 'p-4' : 'p-5'} {chosen ? 'shadow-[0_0_0_2px_var(--accent)]' : ''}"
    >
      {#if option.icon}
        <span class="grid size-11 shrink-0 place-items-center rounded-[14px] transition-colors {chosen ? 'bg-accent text-accent-ink' : 'bg-well text-ink-soft group-hover:text-ink'}">
          <option.icon class="size-[22px]" />
        </span>
      {/if}
      <span class="min-w-0">
        <span class="block {compact ? 'font-medium' : 'font-semibold'}">{option.title}</span>
        <span class="mt-1 block leading-relaxed text-ink-muted {compact ? 'text-[13px]' : 'text-[15px]'}">{option.text}</span>
      </span>
    </button>
  {/each}
</div>
