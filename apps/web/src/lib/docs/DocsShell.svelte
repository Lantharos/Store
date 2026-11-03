<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import ArrowRight from "@lucide/svelte/icons/arrow-right"
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import { page as current } from "$app/state"
  import type { Page } from "../content/page.ts"
  import { DOC_SECTIONS, docHref } from "./nav.ts"
  import Toc from "./Toc.svelte"

  type Link = { slug: string; title: string } | null

  let {
    page,
    titles,
    previous,
    next,
  }: { page: Page; titles: Record<string, string>; previous: Link; next: Link } = $props()

  let menu = $state(false)

  $effect(() => {
    void current.url.pathname
    menu = false
  })

  function copy(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-copy]")
    if (!button) return
    void navigator.clipboard.writeText(button.dataset.copy!)
    button.textContent = "Copied"
    setTimeout(() => (button.textContent = "Copy"), 1400)
  }
</script>

{#snippet nav()}
  <nav aria-label="Documentation" class="space-y-7 text-[15px]">
    {#each DOC_SECTIONS as section (section.title)}
      <div>
        <p class="px-3 font-medium">{section.title}</p>
        <ul class="mt-1.5 space-y-px">
          {#each section.pages as slug (slug)}
            {@const active = slug === page.slug}
            <li>
              <a
                href={docHref(slug)}
                aria-current={active ? "page" : undefined}
                class="block rounded-xl px-3 py-1.5 transition-colors {active ? 'bg-well text-ink' : 'text-ink-muted hover:text-ink'}"
              >
                {titles[slug]}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    <div class="border-t border-hairline px-3 pt-5">
      <a href="/dashboard" class="button button-sm button-ink">Open the dashboard</a>
    </div>
  </nav>
{/snippet}

<div class="page grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]">
  <aside class="hidden lg:block">
    <div class="sticky top-6 max-h-[calc(100svh-3rem)] overflow-y-auto pt-8 pb-8">{@render nav()}</div>
  </aside>

  <article class="min-w-0 pt-4 lg:pt-8">
    <div class="lg:hidden">
      <button type="button" class="flex w-full items-center justify-between rounded-2xl bg-well px-4 py-3 text-[15px]" aria-expanded={menu} onclick={() => (menu = !menu)}>
        <span>Documentation</span>
        <ChevronDown class="size-4 transition-transform {menu ? 'rotate-180' : ''}" />
      </button>
      {#if menu}<div class="mt-4 mb-2">{@render nav()}</div>{/if}
    </div>

    <header class="mt-6 lg:mt-0">
      <h1 class="text-[34px] leading-tight font-semibold tracking-[-0.03em] sm:text-[42px]">{page.title}</h1>
      <p class="mt-3 text-lg leading-relaxed text-ink-soft">{page.description}</p>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="prose docs mt-8 max-w-[44rem]" onclick={copy}>{@html page.html}</div>

    <nav aria-label="More pages" class="mt-16 grid max-w-[44rem] gap-3 sm:grid-cols-2">
      {#if previous}
        <a href={docHref(previous.slug)} class="group rounded-2xl bg-well p-4 transition-colors hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]">
          <span class="flex items-center gap-1.5 text-[13px] text-ink-muted"><ArrowLeft class="size-3.5" />Previous</span>
          <span class="mt-1 block font-medium">{previous.title}</span>
        </a>
      {:else}<span></span>{/if}
      {#if next}
        <a href={docHref(next.slug)} class="group rounded-2xl bg-well p-4 text-right transition-colors hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]">
          <span class="flex items-center justify-end gap-1.5 text-[13px] text-ink-muted">Next<ArrowRight class="size-3.5" /></span>
          <span class="mt-1 block font-medium">{next.title}</span>
        </a>
      {/if}
    </nav>
  </article>

  {#if page.headings.length > 1}
    <aside class="hidden xl:block">
      <div class="sticky top-6 pt-8"><Toc headings={page.headings} /></div>
    </aside>
  {/if}
</div>

<style>
  .docs :global(.code-block) {
    position: relative;
  }

  .docs :global(.code-block .copy) {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    background: var(--raised);
    color: var(--ink-soft);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    opacity: 0;
    transition: opacity var(--motion-quick) linear;
  }

  .docs :global(.code-block:hover .copy),
  .docs :global(.code-block .copy:focus-visible) {
    opacity: 1;
  }

  .docs :global(pre.shiki) {
    background: color-mix(in oklab, var(--well) 60%, var(--canvas)) !important;
  }
</style>
