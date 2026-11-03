<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left"
  import ChevronRight from "@lucide/svelte/icons/chevron-right"
  import X from "@lucide/svelte/icons/x"
  import type { Screenshot } from "@schelf/protocol"
  import { portal } from "../../ui/overlay/floating.ts"

  let { screenshots, name, index = $bindable() }: { screenshots: Screenshot[]; name: string; index: number | null } = $props()

  let close = $state<HTMLButtonElement>()
  const shot = $derived(index === null ? null : screenshots[index])

  function step(direction: number) {
    if (index === null) return
    index = (index + direction + screenshots.length) % screenshots.length
  }

  $effect(() => {
    if (index === null) return
    const previous = document.activeElement as HTMLElement | null
    close?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") index = null
      else if (event.key === "ArrowRight") step(1)
      else if (event.key === "ArrowLeft") step(-1)
      else if (event.key === "Tab") close?.focus()
      else return
      event.preventDefault()
    }
    addEventListener("keydown", keydown)
    document.documentElement.style.overflow = "hidden"
    return () => {
      removeEventListener("keydown", keydown)
      document.documentElement.style.overflow = ""
      previous?.focus()
    }
  })
</script>

{#if shot && index !== null}
  <div {@attach portal} role="dialog" aria-modal="true" aria-label="{name} screenshots" class="lightbox fixed inset-0 z-50 grid place-items-center bg-[rgb(18_17_14/0.92)] p-4 sm:p-12">
    <button type="button" aria-label="Close" tabindex="-1" class="absolute inset-0 cursor-zoom-out" onclick={() => (index = null)}></button>
    {#key index}
      <img src={shot.url} alt={shot.caption ?? `${name}, screenshot ${index + 1}`} class="photo relative max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
    {/key}
    <div class="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 text-[15px] text-[#ece9e3]">
      {#if screenshots.length > 1}
        <button type="button" aria-label="Previous" onclick={() => step(-1)} class="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronLeft class="size-5" /></button>
        <span class="min-w-16 text-center tabular">{index + 1} of {screenshots.length}</span>
        <button type="button" aria-label="Next" onclick={() => step(1)} class="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronRight class="size-5" /></button>
      {/if}
    </div>
    <button bind:this={close} type="button" aria-label="Close" onclick={() => (index = null)} class="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/10 text-[#ece9e3] hover:bg-white/20">
      <X class="size-5" />
    </button>
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .lightbox {
      animation: fade var(--motion-standard) linear both;
    }

    .photo {
      animation: zoom var(--spring-smooth-duration) var(--spring-smooth) both;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes zoom {
    from {
      opacity: 0;
      scale: 0.96;
    }
  }
</style>
