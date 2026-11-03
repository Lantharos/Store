<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left"
  import ChevronRight from "@lucide/svelte/icons/chevron-right"
  import type { Screenshot } from "@schelf/protocol"
  import Lightbox from "./Lightbox.svelte"

  let { screenshots, name }: { screenshots: Screenshot[]; name: string } = $props()

  let strip = $state<HTMLElement>()
  let viewing = $state<number | null>(null)
  let atStart = $state(true)
  let atEnd = $state(false)

  function measure() {
    if (!strip) return
    atStart = strip.scrollLeft < 8
    atEnd = strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 8
  }

  function page(direction: number) {
    strip?.scrollBy({
      left: direction * strip.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }

  $effect(() => {
    measure()
  })
</script>

<section aria-label="Screenshots" class="group/strip relative">
  <ul
    bind:this={strip}
    onscroll={measure}
    class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 scrollbar-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
  >
    {#each screenshots as shot, index (shot.url)}
      <li class="shrink-0 snap-start scroll-ml-4 sm:scroll-ml-6 lg:scroll-ml-8 {screenshots.length === 1 ? 'w-full' : ''}">
        <button
          type="button"
          class="block cursor-zoom-in overflow-hidden rounded-[14px]"
          aria-label={shot.caption ?? `Screenshot ${index + 1} of ${name}`}
          onclick={() => (viewing = index)}
        >
          <img
            src={shot.url}
            alt={shot.caption ?? `${name}, screenshot ${index + 1}`}
            width={shot.width}
            height={shot.height}
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
            class="shot bg-well object-cover {screenshots.length === 1 ? 'aspect-[16/9] w-full max-h-[34rem]' : 'h-[min(56vw,26rem)] w-auto'}"
          />
        </button>
        {#if shot.caption && screenshots.length > 1}<p class="mt-2 text-[13px] text-ink-muted">{shot.caption}</p>{/if}
      </li>
    {/each}
  </ul>
  {#if screenshots.length > 1}
    {#each [{ direction: -1, hidden: atStart, label: "Previous screenshots", Icon: ChevronLeft, side: "left-2" }, { direction: 1, hidden: atEnd, label: "Next screenshots", Icon: ChevronRight, side: "right-2" }] as arrow (arrow.direction)}
      <button
        type="button"
        aria-label={arrow.label}
        tabindex="-1"
        onclick={() => page(arrow.direction)}
        class="absolute top-[calc(50%-1.5rem)] {arrow.side} hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-raised/90 shadow-float ring-1 ring-hairline backdrop-blur transition-opacity sm:grid {arrow.hidden
          ? 'pointer-events-none opacity-0'
          : 'opacity-0 group-hover/strip:opacity-100'}"
      >
        <arrow.Icon class="size-5" />
      </button>
    {/each}
  {/if}
</section>

<Lightbox {screenshots} {name} bind:index={viewing} />
