<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import { plural } from "#lib/format.ts"
  import Meta from "#lib/seo/Meta.svelte"
  import AppGrid from "#lib/store/apps/AppGrid.svelte"

  let { data } = $props()
  const apps = $derived(data.developer.apps.filter((app) => app.kind === "app"))
  const extensions = $derived(data.developer.apps.filter((app) => app.kind === "extension"))
  const installs = $derived(data.developer.apps.reduce((sum, app) => sum + app.installs_30d, 0))
</script>

<Meta
  title="{data.developer.name} · Schelf"
  description="Apps by {data.developer.name} on Schelf."
  path="/developers/{data.developer.slug}"
/>

<div class="page">
  <header class="mt-6 sm:mt-10">
    <h1 class="flex items-center gap-2.5 text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">
      {data.developer.name}
      {#if data.developer.verified}
        <BadgeCheck class="size-7 text-accent" aria-label="Verified developer" />
      {/if}
    </h1>
    <p class="mt-2 text-ink-muted">
      {plural(data.developer.apps.length, "app")} on Schelf · {plural(installs, "install")} in the last 30 days
    </p>
  </header>
  {#if apps.length}
    <section class="mt-8" aria-label="Apps"><AppGrid {apps} /></section>
  {/if}
  {#if extensions.length}
    <section class="mt-12" aria-labelledby="extensions">
      <h2 id="extensions" class="text-xl font-semibold">Luft extensions</h2>
      <div class="mt-3"><AppGrid apps={extensions} /></div>
    </section>
  {/if}
</div>
