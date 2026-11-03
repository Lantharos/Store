<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import { plural } from "#lib/format.ts"
  import Meta from "#lib/seo/Meta.svelte"
  import { publisherSchema } from "#lib/seo/schema.ts"
  import AppGrid from "#lib/store/apps/AppGrid.svelte"

  let { data } = $props()
  const publisher = $derived(data.publisher)
  const apps = $derived(publisher.apps.filter((app) => app.kind === "app"))
  const extensions = $derived(publisher.apps.filter((app) => app.kind === "extension"))
  const installs = $derived(publisher.apps.reduce((sum, app) => sum + app.installs_30d, 0))
  const path = $derived(`/publishers/${publisher.slug}`)
  const host = $derived(publisher.website ? new URL(publisher.website).host : null)
</script>

<Meta
  title="{publisher.name} · Schelf"
  description={publisher.description || `Apps by ${publisher.name} on Schelf.`}
  {path}
  schema={publisherSchema(publisher, path)}
/>

<div class="page">
  <header class="enter mt-6 flex flex-col gap-6 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
    {#if publisher.logo}
      <img src={publisher.logo} alt="" class="size-20 shrink-0 rounded-[28%] object-cover shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] sm:size-28" />
    {/if}
    <div class="min-w-0">
      <h1 class="flex items-center gap-2.5 text-[32px] leading-none font-semibold tracking-[-0.03em] sm:text-[44px]">
        {publisher.name}
        {#if publisher.verified}
          <BadgeCheck class="size-7 shrink-0 text-accent sm:size-8" aria-label="Verified publisher" />
        {/if}
      </h1>
      {#if publisher.description}<p class="mt-3 max-w-2xl text-ink-soft sm:text-lg">{publisher.description}</p>{/if}
      <p class="mt-2 flex flex-wrap items-center gap-x-1.5 text-[15px] text-ink-muted">
        {#if host}
          <a href={publisher.website} rel="noopener" class="inline-flex items-center gap-0.5 hover:text-ink">{host}<ArrowUpRight class="size-3.5" /></a>
          <span aria-hidden="true">·</span>
        {/if}
        {plural(publisher.apps.length, publisher.apps.length === extensions.length ? "extension" : "app")} on Schelf
        {#if installs}<span aria-hidden="true">·</span>{plural(installs, "install")} in the last 30 days{/if}
      </p>
      {#if publisher.verified}
        <p class="mt-1 text-[13px] text-ink-muted">Schelf checked who {publisher.name} is and that its domains are its own.</p>
      {/if}
    </div>
  </header>
  {#if apps.length}
    <section class="mt-10" aria-label="Apps"><AppGrid {apps} /></section>
  {/if}
  {#if extensions.length}
    <section class="mt-12" aria-labelledby="extensions">
      <h2 id="extensions" class="text-xl font-semibold">Luft extensions</h2>
      <div class="mt-3"><AppGrid apps={extensions} /></div>
    </section>
  {/if}
  {#if !publisher.apps.length}
    <p class="mt-10 text-ink-muted">Nothing listed yet.</p>
  {/if}
</div>
