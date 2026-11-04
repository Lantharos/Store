<script lang="ts">
  import { page } from "$app/state"
  import SettingsSidebar from "../settings/SettingsSidebar.svelte"
  import { SETTINGS } from "../settings/sections.ts"
  import AppSidebar from "./AppSidebar.svelte"

  let { onsearch }: { onsearch: () => void } = $props()
  const settings = $derived(page.url.pathname.startsWith(SETTINGS))
</script>

<div class="h-full overflow-hidden">
  <div class="track grid h-full w-[200%] grid-cols-2 grid-rows-[minmax(0,1fr)]" class:settings>
    <div class="min-w-0" inert={settings}><AppSidebar {onsearch} /></div>
    <div class="min-w-0" inert={!settings}><SettingsSidebar /></div>
  </div>
</div>

<style>
  .track {
    transition: translate var(--spring-smooth-duration) var(--spring-smooth);
  }

  .track.settings {
    translate: -50% 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .track {
      transition: none;
    }
  }
</style>
