<script lang="ts">
  import Menu from "@lucide/svelte/icons/menu"
  import Search from "@lucide/svelte/icons/search"
  import X from "@lucide/svelte/icons/x"
  import { page } from "$app/state"
  import Logo from "../../Logo.svelte"
  import SearchBox from "../search/SearchBox.svelte"

  const NAV = [
    { href: "/", label: "Discover", match: (path: string) => path === "/" },
    { href: "/categories", label: "Categories", match: (path: string) => path.startsWith("/categories") },
    { href: "/extensions", label: "Extensions", match: (path: string) => path.startsWith("/extensions") },
  ]

  let sheet = $state<"menu" | "search" | null>(null)
  const path = $derived(page.url.pathname)

  $effect(() => {
    void path
    sheet = null
  })
</script>

<header class="page relative z-30 flex h-[4.75rem] items-center gap-4 lg:gap-6">
  <a href="/" class="flex items-center gap-2.5 rounded-xl text-lg font-semibold tracking-[-0.01em]" aria-label="Schelf, home">
    <Logo />
    <span>Schelf</span>
  </a>
  <nav aria-label="Store" class="ml-4 hidden gap-1 text-[15px] md:flex">
    {#each NAV as item (item.href)}
      <a
        href={item.href}
        aria-current={item.match(path) ? "page" : undefined}
        class="rounded-full px-3 py-1.5 text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:font-medium"
      >
        {item.label}
      </a>
    {/each}
  </nav>
  <div class="ml-auto hidden w-full max-w-80 md:block">
    <SearchBox />
  </div>
  <a href="/dashboard" class="hidden text-[15px] whitespace-nowrap text-ink-soft transition-colors hover:text-ink lg:block">Dashboard</a>
  <div class="ml-auto flex gap-1 md:hidden">
    <button type="button" class="button size-10 p-0 hover:bg-well" aria-label="Search" onclick={() => (sheet = sheet === "search" ? null : "search")}>
      <Search class="size-5" />
    </button>
    <button
      type="button"
      class="button size-10 p-0 hover:bg-well"
      aria-label={sheet === "menu" ? "Close menu" : "Menu"}
      aria-expanded={sheet === "menu"}
      onclick={() => (sheet = sheet === "menu" ? null : "menu")}
    >
      {#if sheet === "menu"}<X class="size-5" />{:else}<Menu class="size-5" />{/if}
    </button>
  </div>
</header>

{#if sheet}
  <div class="sheet page relative z-30 pb-4 md:hidden">
    {#if sheet === "search"}
      <SearchBox autofocus onnavigate={() => (sheet = null)} />
    {:else}
      <nav aria-label="Store" class="flex flex-col text-lg">
        {#each [...NAV, { href: "/dashboard", label: "Dashboard", match: () => false }] as item (item.href)}
          <a href={item.href} aria-current={item.match(path) ? "page" : undefined} class="border-b border-hairline py-3.5 aria-[current=page]:font-semibold">{item.label}</a>
        {/each}
      </nav>
    {/if}
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .sheet {
      animation: open var(--spring-snappy-duration) var(--spring-snappy) both;
    }
  }

  @keyframes open {
    from {
      opacity: 0;
      translate: 0 -0.5rem;
    }
  }
</style>
