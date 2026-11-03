<script lang="ts">
  import type { CatalogEntry } from "@schelf/protocol"
  import { appHref } from "../links.ts"
  import AppIcon from "./AppIcon.svelte"
  import { tileStyle } from "./tile.ts"

  let {
    app,
    brand,
    blurb,
    screenshot,
    large = false,
    order = 0,
  }: {
    app: CatalogEntry
    brand: string | null
    blurb: string | null
    screenshot: string | null
    large?: boolean
    order?: number
  } = $props()
</script>

<a
  href={appHref(app)}
  style={tileStyle(brand)}
  style:--order={order}
  class="tile enter group relative flex flex-col overflow-hidden rounded-tile bg-(--tile) text-(--tile-ink) {large
    ? 'min-h-[22rem] p-6 pb-0 sm:p-9 sm:pb-0'
    : 'p-6 sm:p-7'}"
>
  <div class="flex items-start gap-4">
    <AppIcon src={app.icon} name={app.name} eager class={large ? "size-14" : "size-12"} />
    <div class="min-w-0 flex-1">
      <h2 class="font-semibold leading-tight tracking-[-0.02em] {large ? 'text-[28px]' : 'text-xl'}">{app.name}</h2>
      <p class="mt-1 text-(--tile-soft) {large ? '' : 'text-[15px]'}">{app.summary}</p>
    </div>
    {#if Object.keys(app.platforms).length}
      <span class="button shrink-0 bg-(--tile-button) text-(--tile-button-ink) {large ? '' : 'button-sm'}">Get</span>
    {/if}
  </div>
  {#if large && screenshot}
    <img
      src={screenshot}
      alt=""
      loading="eager"
      fetchpriority="high"
      class="shot mt-8 w-full translate-y-3 rounded-b-none transition-transform duration-(--spring-smooth-duration) ease-(--spring-smooth) group-hover:translate-y-1"
    />
  {:else}
    <div class="mt-auto flex min-h-28 items-end gap-5 pt-5">
      {#if blurb}
        <p class="line-clamp-4 flex-1 text-[15px] leading-relaxed text-(--tile-soft) {screenshot ? 'sm:max-w-[48%] lg:max-w-[46%]' : 'max-w-sm'}">{blurb}</p>
      {/if}
      {#if screenshot}
        <img
          src={screenshot}
          alt=""
          loading="eager"
          class="shot pointer-events-none absolute -right-10 -bottom-12 hidden w-[52%] transition-transform duration-(--spring-smooth-duration) ease-(--spring-smooth) group-hover:-translate-y-1.5 sm:block"
        />
      {/if}
    </div>
  {/if}
</a>

<style>
  .tile {
    transition: transform var(--spring-smooth-duration) var(--spring-smooth);
  }

  .tile:active {
    transform: scale(0.99);
  }
</style>
