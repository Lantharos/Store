<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import AppGrid from "#lib/store/apps/AppGrid.svelte"
  import CategoryLinks from "#lib/store/apps/CategoryLinks.svelte"

  let { data } = $props()
  const store = $derived(data.results.filter((hit) => hit.origin === "schelf"))
  const mirrored = $derived(data.results.filter((hit) => hit.origin !== "schelf"))
</script>

<Meta title={data.query ? `“${data.query}” · Schelf` : "Search · Schelf"} description="Search apps on Schelf." path="/search" indexed={false} />

<div class="page">
  {#if data.query}
    <h1 class="mt-6 text-[28px] font-semibold tracking-[-0.02em] sm:mt-10 sm:text-[34px]">
      {data.results.length ? "Results for" : "Nothing found for"} “{data.query}”
    </h1>
    {#if store.length}
      <div class="mt-6"><AppGrid apps={store} /></div>
    {/if}
    {#if mirrored.length}
      <section class="mt-12" aria-labelledby="mirrored">
        <h2 id="mirrored" class="text-xl font-semibold">From Flathub and Fedora</h2>
        <p class="mt-1 max-w-xl text-[15px] text-ink-muted">Linux apps published elsewhere. Schelf on Luft installs and updates them for you.</p>
        <div class="mt-3"><AppGrid apps={mirrored} /></div>
      </section>
    {/if}
    {#if !data.results.length}
      <p class="mt-3 max-w-xl leading-relaxed text-ink-soft">Try a shorter word, or what the app does rather than its name, like “photos” or “notes”.</p>
    {/if}
  {:else}
    <h1 class="mt-6 text-[28px] font-semibold tracking-[-0.02em] sm:mt-10 sm:text-[34px]">Search</h1>
    <form action="/search" class="mt-6 max-w-xl">
      <input name="q" type="search" placeholder="Search apps" aria-label="Search apps" class="field h-12 rounded-full px-5 text-[17px]" />
    </form>
    {#if data.categories.length}
      <h2 class="mt-12 text-xl font-semibold">Or browse</h2>
      <CategoryLinks categories={data.categories} class="mt-4" />
    {/if}
  {/if}
</div>
