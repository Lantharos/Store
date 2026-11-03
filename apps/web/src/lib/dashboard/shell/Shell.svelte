<script lang="ts">
  import Menu from "@lucide/svelte/icons/menu"
  import type { Snippet } from "svelte"
  import { page } from "$app/state"
  import Logo from "../../Logo.svelte"
  import Palette from "./Palette.svelte"
  import SidebarSwitcher from "./SidebarSwitcher.svelte"

  let { children }: { children: Snippet } = $props()
  let drawer = $state(false)
  let palette = $state(false)

  $effect(() => {
    void page.url.pathname
    drawer = false
  })

  $effect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        palette = !palette
      }
    }
    addEventListener("keydown", keydown)
    return () => removeEventListener("keydown", keydown)
  })
</script>

<a href="#content" class="skip">Skip to content</a>
<div class="min-h-svh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside class="sticky top-0 hidden h-svh bg-raised lg:block">
    <SidebarSwitcher onsearch={() => (palette = true)} />
  </aside>

  <header class="sticky top-0 z-20 flex h-14 items-center gap-3 bg-glass px-4 backdrop-blur-xl lg:hidden">
    <button type="button" class="button size-10 p-0 hover:bg-well" aria-label="Menu" aria-expanded={drawer} onclick={() => (drawer = true)}>
      <Menu class="size-5" />
    </button>
    <a href="/dashboard" class="flex items-center gap-2 font-semibold"><Logo class="size-7" />Schelf</a>
  </header>

  {#if drawer}
    <div class="fixed inset-0 z-40 lg:hidden">
      <button type="button" aria-label="Close menu" class="scrim absolute inset-0 bg-scrim" onclick={() => (drawer = false)}></button>
      <aside class="drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-raised shadow-float">
        <SidebarSwitcher onsearch={() => ((drawer = false), (palette = true))} />
      </aside>
    </div>
  {/if}

  <main id="content" class="min-w-0 px-4 pt-6 pb-24 sm:px-8 lg:px-12 lg:pt-10">
    <div class="mx-auto max-w-[68rem]">{@render children()}</div>
  </main>
</div>

<Palette bind:open={palette} />

<style>
  @media (prefers-reduced-motion: no-preference) {
    .drawer {
      animation: slide var(--spring-smooth-duration) var(--spring-smooth) both;
    }

    .scrim {
      animation: fade var(--motion-standard) linear both;
    }
  }

  @keyframes slide {
    from {
      translate: -100% 0;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
