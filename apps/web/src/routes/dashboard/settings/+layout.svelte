<script lang="ts">
  import type { Snippet } from "svelte"
  import SettingsNav from "#lib/dashboard/settings/SettingsNav.svelte"

  let { children }: { children: Snippet } = $props()
</script>

<div class="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
  <aside class="mb-8 lg:sticky lg:top-10 lg:mb-0 lg:self-start">
    <p class="mb-6 px-3 text-[13px] font-medium text-ink-muted max-lg:sr-only">Settings</p>
    <SettingsNav />
  </aside>
  <div class="min-w-0">{@render children()}</div>
</div>
