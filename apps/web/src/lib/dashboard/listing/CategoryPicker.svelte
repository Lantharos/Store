<script lang="ts">
  import GripVertical from "@lucide/svelte/icons/grip-vertical"
  import Plus from "@lucide/svelte/icons/plus"
  import X from "@lucide/svelte/icons/x"
  import { MAX_CATEGORIES } from "@schelf/protocol"
  import { flip } from "svelte/animate"
  import { CATEGORY_CHOICES, categoryLabel } from "../../store/categories.ts"

  let { categories = $bindable(), saved }: { categories: string[]; saved: string[] } = $props()

  let dragging = $state<string | null>(null)
  let announcement = $state("")
  let list = $state<HTMLElement>()
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  const choices = $derived(
    [...new Set([...saved, ...CATEGORY_CHOICES])].filter((name) => !categories.includes(name)),
  )
  const full = $derived(categories.length >= MAX_CATEGORIES)

  function move(name: string, to: number) {
    const next = categories.filter((category) => category !== name)
    next.splice(to, 0, name)
    categories = next
    announcement =
      to === 0
        ? `${categoryLabel(name)} is now your primary category`
        : `${categoryLabel(name)} moved to place ${to + 1}`
  }

  function start(event: PointerEvent, name: string) {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragging = name
  }

  function drag(event: PointerEvent) {
    if (!dragging || !list) return
    const rows = [...list.querySelectorAll<HTMLElement>("[data-category]")]
    const target = rows.find((row) => {
      const { top, bottom } = row.getBoundingClientRect()
      return event.clientY > top && event.clientY < bottom
    })?.dataset.category
    if (target && target !== dragging) move(dragging, categories.indexOf(target))
  }

  function keyboard(event: KeyboardEvent, name: string, index: number) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
    const to = index + step
    if (!step || to < 0 || to >= categories.length) return
    event.preventDefault()
    move(name, to)
    requestAnimationFrame(() =>
      list?.querySelector<HTMLElement>(`[data-category="${name}"] [data-handle]`)?.focus(),
    )
  }

  const remove = (name: string) => (categories = categories.filter((category) => category !== name))
  const add = (name: string) => (categories = [...categories, name])
</script>

<div class="space-y-4">
  {#if categories.length}
    <ol bind:this={list} class="space-y-1" onpointermove={drag} onpointerup={() => (dragging = null)} onpointercancel={() => (dragging = null)}>
      {#each categories as name, index (name)}
        <li
          data-category={name}
          animate:flip={{ duration: still ? 0 : 220 }}
          class="flex items-center gap-1 rounded-xl py-1 pr-1 pl-1 transition-[box-shadow,scale] {dragging === name ? 'relative z-10 scale-[1.02] bg-raised shadow-float' : 'bg-well'}"
        >
          <button
            type="button"
            data-handle
            aria-label="Move {categoryLabel(name)}, place {index + 1} of {categories.length}. Use the up and down arrow keys."
            onpointerdown={(event) => start(event, name)}
            onkeydown={(event) => keyboard(event, name, index)}
            class="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-muted hover:text-ink active:cursor-grabbing"
          >
            <GripVertical class="size-4" />
          </button>
          <span class="min-w-0 flex-1 truncate text-[15px]">{categoryLabel(name)}</span>
          {#if index === 0}
            <span class="px-2 text-[13px] text-ink-muted">Primary</span>
          {:else}
            <button type="button" onclick={() => move(name, 0)} class="rounded-lg px-2 py-1 text-[13px] text-ink-muted hover:text-ink">Make primary</button>
          {/if}
          <button type="button" aria-label="Remove {categoryLabel(name)}" onclick={() => remove(name)} class="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:text-ink">
            <X class="size-4" />
          </button>
        </li>
      {/each}
    </ol>
  {/if}
  <div class="flex flex-wrap gap-2">
    {#each choices as name (name)}
      <button type="button" disabled={full} onclick={() => add(name)} class="button button-sm button-quiet">
        <Plus class="size-3.5" />{categoryLabel(name)}
      </button>
    {/each}
  </div>
  <p aria-live="polite" class="sr-only">{announcement}</p>
</div>
