<script lang="ts">
  import type { Component } from "svelte"

  let {
    title,
    text,
    icon: Icon,
    chosen,
    onclick,
  }: {
    title: string
    text: string
    icon?: Component<{ class?: string }>
    chosen: boolean
    onclick: () => void
  } = $props()
</script>

<button
  type="button"
  role="radio"
  aria-checked={chosen}
  {onclick}
  class="group flex w-full items-start gap-4 rounded-group bg-raised p-5 text-left transition-[box-shadow,background-color] hover:bg-[color-mix(in_oklab,var(--raised)_94%,var(--ink))] {chosen ? 'shadow-[0_0_0_2px_var(--accent)]' : ''}"
>
  {#if Icon}
    <span class="grid size-11 shrink-0 place-items-center rounded-[14px] transition-colors {chosen ? 'bg-accent text-accent-ink' : 'bg-well text-ink-soft group-hover:text-ink'}">
      <Icon class="size-[22px]" />
    </span>
  {/if}
  <span class="min-w-0">
    <span class="block font-semibold">{title}</span>
    <span class="mt-1 block text-[15px] leading-relaxed text-ink-muted">{text}</span>
  </span>
</button>
