<script lang="ts">
  import Search from "@lucide/svelte/icons/search"
  import { goto } from "$app/navigation"
  import { type DocSection, hitHref, searchDocs } from "./search.ts"

  const id = $props.id()
  let input = $state<HTMLInputElement>()
  let sections = $state<DocSection[]>([])
  let query = $state("")
  let focused = $state(false)
  let active = $state(-1)
  const hits = $derived(searchDocs(sections, query))
  const open = $derived(focused && query.trim().length > 0)

  async function loadIndex() {
    focused = true
    if (sections.length) return
    const response = await fetch("/docs/search.json")
    sections = await response.json()
  }

  function go(section: DocSection) {
    query = ""
    active = -1
    input?.blur()
    void goto(hitHref(section))
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" && hits.length) active = (active + 1) % hits.length
    else if (event.key === "ArrowUp" && hits.length) active = active <= 0 ? hits.length - 1 : active - 1
    else if (event.key === "Escape") {
      if (query) query = ""
      else input?.blur()
    } else if (event.key === "Enter" && hits.length) go(hits[Math.max(active, 0)]!.section)
    else return
    event.preventDefault()
  }
</script>

<div role="search" class="relative shrink-0">
  <label class="flex h-10 items-center gap-2.5 rounded-full bg-well px-4 text-[15px] transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]">
    <Search class="size-4 shrink-0 text-ink-muted" strokeWidth={2.2} />
    <span class="sr-only">Search the docs</span>
    <input
      bind:this={input}
      bind:value={query}
      type="search"
      placeholder="Search the docs"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-expanded={open}
      aria-controls="{id}-results"
      aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
      class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      oninput={() => (active = -1)}
      onfocus={loadIndex}
      onblur={() => (focused = false)}
      onkeydown={keydown}
    />
  </label>

  {#if open}
    <div
      id="{id}-results"
      role="listbox"
      aria-label="Search results"
      tabindex="-1"
      onmousedown={(event) => event.preventDefault()}
      class="results absolute top-12 left-0 z-40 max-h-[min(28rem,70svh)] w-full overflow-y-auto rounded-2xl bg-raised p-1.5 shadow-float ring-1 ring-hairline scrollbar-none lg:w-[28rem]"
    >
      {#each hits as { section, snippet }, index (`${section.slug}#${section.id}`)}
        <a
          id="{id}-{index}"
          role="option"
          aria-selected={index === active}
          href={hitHref(section)}
          onclick={(event) => {
            event.preventDefault()
            go(section)
          }}
          onpointermove={() => (active = index)}
          class="block rounded-xl px-3 py-2 {index === active ? 'bg-well' : ''}"
        >
          <span class="block truncate text-[15px] font-medium">
            {section.page}{#if section.heading}<span class="font-normal text-ink-muted">{` · ${section.heading}`}</span>{/if}
          </span>
          <span class="mt-0.5 line-clamp-2 block text-[13px] text-ink-muted">{snippet}</span>
        </a>
      {:else}
        <p class="px-3 py-3 text-[15px] text-ink-muted">Nothing about “{query.trim()}” in the docs.</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .results {
      animation: drop var(--spring-snappy-duration) var(--spring-snappy) both;
    }
  }

  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 -0.25rem;
    }
  }
</style>
