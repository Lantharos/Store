<script lang="ts" module>
  export interface MenuItem {
    label: string
    hint?: string
    danger?: boolean
    selected?: boolean
    onselect: () => void
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import { focusOnMount } from "../focus.ts"
  import type { Placement } from "./floating.ts"
  import Popover from "./Popover.svelte"

  let {
    open = $bindable(false),
    anchor,
    items,
    placement = "bottom-start",
    class: className = "w-60",
  }: {
    open?: boolean
    anchor: Element | null | undefined
    items: MenuItem[]
    placement?: Placement
    class?: string
  } = $props()

  let active = $state(0)

  $effect(() => {
    if (open) active = Math.max(0, items.findIndex((item) => item.selected))
  })

  function select(item: MenuItem | undefined) {
    if (!item) return
    open = false
    item.onselect()
    if (anchor instanceof HTMLElement) anchor.focus()
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") active = (active + 1) % items.length
    else if (event.key === "ArrowUp") active = (active - 1 + items.length) % items.length
    else if (event.key === "Home") active = 0
    else if (event.key === "End") active = items.length - 1
    else if (event.key === "Enter" || event.key === " ") select(items[active])
    else if (event.key === "Tab") open = false
    else return
    event.preventDefault()
  }
</script>

<Popover bind:open {anchor} {placement} class="p-1.5 {className}">
  <div
    role="menu"
    tabindex="-1"
    aria-activedescendant="menu-item-{active}"
    class="outline-none"
    onkeydown={keydown}
    {@attach focusOnMount}
  >
    {#each items as item, index (item.label)}
      <button
        id="menu-item-{index}"
        type="button"
        role="menuitem"
        tabindex="-1"
        onpointermove={() => (active = index)}
        onclick={() => select(item)}
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[15px] {index === active
          ? 'bg-well'
          : ''} {item.danger ? 'text-danger' : 'text-ink'}"
      >
        <span class="flex-1 truncate">{item.label}</span>
        {#if item.hint}<span class="text-[13px] text-ink-muted">{item.hint}</span>{/if}
        {#if item.selected}<Check class="size-4 text-accent" />{/if}
      </button>
    {/each}
  </div>
</Popover>
