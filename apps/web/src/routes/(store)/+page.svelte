<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import AppGrid from "#lib/store/apps/AppGrid.svelte"
  import FeaturedTile from "#lib/store/apps/FeaturedTile.svelte"
  import CategoryLinks from "#lib/store/apps/CategoryLinks.svelte"
  import Trust from "#lib/store/home/Trust.svelte"
  import { categoryHref } from "#lib/store/categories.ts"

  let { data } = $props()
  const [lead, ...rest] = $derived(data.hero)
</script>

<Meta
  title="Schelf: apps for Luft, Linux, Windows and macOS"
  description="Download apps that are checked by a person before they reach you, and keep them up to date without being tracked."
  path="/"
  schema={data.schema}
/>

<h1 class="sr-only">Schelf</h1>

<div class="page">
  {#if lead}
    <section aria-label="Featured" class="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-[1.35fr_1fr] lg:gap-5">
      <FeaturedTile app={lead.app} brand={lead.brand} blurb={lead.blurb} screenshot={lead.screenshot} large />
      {#if rest.length}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 lg:gap-5">
          {#each rest as tile, index (tile.app.id)}
            <FeaturedTile app={tile.app} brand={tile.brand} blurb={tile.blurb} screenshot={null} order={index + 1} />
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if data.categories.length}
    <CategoryLinks categories={data.categories} class="mt-8" />
  {/if}

  {#each data.sections as section (section.id)}
    <section class="mt-12" aria-labelledby="section-{section.id}">
      <div class="flex items-baseline justify-between gap-4">
        <h2 id="section-{section.id}" class="text-2xl font-semibold tracking-[-0.02em]">{section.title}</h2>
        {#if section.id.startsWith("category:")}
          <a href={categoryHref(section.id.slice(9))} class="text-[15px] text-accent hover:underline">See all</a>
        {/if}
      </div>
      <div class="mt-3">
        <AppGrid apps={section.apps.slice(0, 9)} />
      </div>
    </section>
  {:else}
    <section class="mt-16 max-w-xl">
      <h2 class="text-2xl font-semibold tracking-[-0.02em]">The first apps are on their way</h2>
      <p class="mt-2 leading-relaxed text-ink-soft">Developers are publishing their first releases. Check back soon, or <a href="/docs" class="link">publish yours</a>.</p>
    </section>
  {/each}

  <Trust />
</div>
