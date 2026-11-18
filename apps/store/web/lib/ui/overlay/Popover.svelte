<script lang="ts">
  import type { Snippet } from "svelte"
  import { type Placement, portal, position } from "./floating.ts"

  let {
    open = $bindable(false),
    anchor,
    placement = "bottom-start",
    class: className = "",
    onclose,
    children,
  }: {
    open?: boolean
    anchor: Element | null | undefined
    placement?: Placement
    class?: string
    onclose?: () => void
    children: Snippet
  } = $props()

  let floating = $state<HTMLElement>()

  function close() {
    open = false
    onclose?.()
  }

  $effect(() => {
    if (!open || !floating || !anchor) return
    const node = floating
    const update = () => position(anchor, node, placement)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    addEventListener("resize", update)
    addEventListener("scroll", update, true)
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!node.contains(target) && !anchor.contains(target)) close()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      close()
      if (anchor instanceof HTMLElement) anchor.focus()
    }
    document.addEventListener("pointerdown", outside, true)
    document.addEventListener("keydown", onEscape, true)
    return () => {
      observer.disconnect()
      removeEventListener("resize", update)
      removeEventListener("scroll", update, true)
      document.removeEventListener("pointerdown", outside, true)
      document.removeEventListener("keydown", onEscape, true)
    }
  })
</script>

{#if open}
  <div
    {@attach portal}
    bind:this={floating}
    class="pop fixed top-0 left-0 z-50 rounded-2xl bg-raised shadow-float ring-1 ring-hairline {className}"
  >
    {@render children()}
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .pop {
      animation: pop var(--spring-snappy-duration) var(--spring-snappy) both;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      scale: 0.97;
    }
  }
</style>
