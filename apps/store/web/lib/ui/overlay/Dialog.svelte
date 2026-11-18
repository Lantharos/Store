<script lang="ts">
  import type { Snippet } from "svelte"
  import { trapFocus } from "../focus.ts"
  import { portal } from "./floating.ts"

  let {
    open = $bindable(false),
    class: className = "max-w-md",
    label,
    onclose,
    children,
  }: { open?: boolean; class?: string; label?: string; onclose?: () => void; children: Snippet } = $props()

  const id = $props.id()
  let panel = $state<HTMLElement>()
  let labelledby = $state<string>()

  function close() {
    open = false
    onclose?.()
  }

  $effect(() => {
    if (!open || !panel) return
    const node = panel
    const previous = document.activeElement as HTMLElement | null
    const heading = label ? null : node.querySelector("h1, h2, h3")
    if (heading) heading.id ||= `${id}-title`
    labelledby = heading?.id
    node.querySelector<HTMLElement>("[autofocus], input, textarea, button:not([data-dismiss])")?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Tab") trapFocus(event, node)
      else if (event.key === "Escape" && !event.defaultPrevented) {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener("keydown", keydown)
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", keydown)
      document.documentElement.style.overflow = overflow
      previous?.focus()
    }
  })
</script>

{#if open}
  <div {@attach portal} class="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-3 sm:items-start sm:px-4 sm:pt-[14vh]">
    <button type="button" aria-label="Close" tabindex="-1" data-dismiss class="scrim fixed inset-0 bg-scrim" onclick={close}></button>
    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledby}
      class="panel relative w-full rounded-3xl bg-raised shadow-float ring-1 ring-hairline {className}"
    >
      {@render children()}
    </div>
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .scrim {
      animation: fade var(--motion-standard) linear both;
    }

    .panel {
      animation: rise var(--spring-smooth-duration) var(--spring-smooth) both;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 1rem;
      scale: 0.98;
    }
  }
</style>
