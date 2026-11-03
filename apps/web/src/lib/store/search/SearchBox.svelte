<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import Search from "@lucide/svelte/icons/search"
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { platformParam } from "../../system/detect.ts"
  import Kbd from "../../ui/Kbd.svelte"
  import AppIcon from "../apps/AppIcon.svelte"
  import { appHref, originOf } from "../links.ts"
  import { LiveSearch } from "./live.svelte.ts"

  let { autofocus = false, onnavigate }: { autofocus?: boolean; onnavigate?: () => void } = $props()

  const id = $props.id()
  const live = new LiveSearch(() => platformParam(page.data.system))
  let input = $state<HTMLInputElement>()
  let focused = $state(false)
  let active = $state(-1)
  const open = $derived(focused && live.query.trim().length > 0)
  const options = $derived(live.results.length + 1)

  $effect(() => {
    if (autofocus) input?.focus()
  })

  $effect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")
      if ((event.key === "/" && !typing) || (event.key === "k" && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        input?.focus()
        input?.select()
      }
    }
    addEventListener("keydown", shortcut)
    return () => removeEventListener("keydown", shortcut)
  })

  function hrefAt(index: number) {
    const hit = live.results[index]
    return hit ? appHref(hit) : `/search?q=${encodeURIComponent(live.query.trim())}`
  }

  function go(href: string) {
    focused = false
    input?.blur()
    onnavigate?.()
    void goto(href)
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") active = (active + 1) % options
    else if (event.key === "ArrowUp") active = active <= 0 ? options - 1 : active - 1
    else if (event.key === "Escape") {
      if (live.query) live.update("")
      else input?.blur()
    } else if (event.key === "Enter" && active >= 0) go(hrefAt(active))
    else return
    event.preventDefault()
  }
</script>

<form
  action="/search"
  role="search"
  class="relative w-full"
  onsubmit={(event) => {
    event.preventDefault()
    if (live.query.trim()) go(hrefAt(-1))
  }}
>
  <label class="flex h-10 items-center gap-2.5 rounded-full bg-well px-4 text-[15px] transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]">
    {#if live.loading}
      <LoaderCircle class="size-4 shrink-0 animate-spin text-ink-muted" />
    {:else}
      <Search class="size-4 shrink-0 text-ink-muted" strokeWidth={2.2} />
    {/if}
    <span class="sr-only">Search apps</span>
    <input
      bind:this={input}
      name="q"
      type="search"
      value={live.query}
      placeholder="Search apps"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-expanded={open}
      aria-controls="{id}-results"
      aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
      class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      oninput={(event) => {
        active = -1
        live.update(event.currentTarget.value)
      }}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      onkeydown={keydown}
    />
    {#if !focused && !live.query}<span class="hidden lg:inline-flex"><Kbd keys="/" /></span>{/if}
  </label>

  {#if open}
    <div
      id="{id}-results"
      role="listbox"
      aria-label="Search results"
      tabindex="-1"
      onmousedown={(event) => event.preventDefault()}
      class="results absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl bg-raised p-1.5 shadow-float ring-1 ring-hairline"
    >
      {#each live.results as hit, index (hit.id)}
        {@const origin = originOf(hit)}
        <a
          id="{id}-{index}"
          role="option"
          aria-selected={index === active}
          href={appHref(hit)}
          onclick={(event) => {
            event.preventDefault()
            go(appHref(hit))
          }}
          onpointermove={() => (active = index)}
          class="flex items-center gap-3 rounded-xl px-2.5 py-2 {index === active ? 'bg-well' : ''}"
        >
          <AppIcon src={hit.icon} name={hit.name} class="size-9" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px] font-medium">{hit.name}</span>
            <span class="block truncate text-[13px] text-ink-muted">{origin ? `${hit.summary} · ${origin}` : hit.summary}</span>
          </span>
        </a>
      {:else}
        {#if !live.loading}
          <p class="px-3 py-3 text-[15px] text-ink-muted">Nothing called “{live.query.trim()}” yet.</p>
        {/if}
      {/each}
      <a
        id="{id}-{live.results.length}"
        role="option"
        aria-selected={active === live.results.length}
        href={hrefAt(-1)}
        onclick={(event) => {
          event.preventDefault()
          go(hrefAt(-1))
        }}
        onpointermove={() => (active = live.results.length)}
        class="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-ink-soft {active === live.results.length ? 'bg-well' : ''}"
      >
        <Search class="size-4 text-ink-muted" />
        <span class="truncate">See everything for “{live.query.trim()}”</span>
      </a>
    </div>
  {/if}
</form>

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
