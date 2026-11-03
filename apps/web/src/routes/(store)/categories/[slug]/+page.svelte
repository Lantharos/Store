<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import AppGrid from "#lib/store/apps/AppGrid.svelte"
  import CategoryLinks from "#lib/store/apps/CategoryLinks.svelte"

  let { data } = $props()
</script>

<Meta
  title="{data.name} apps · Schelf"
  description="{data.name} apps for Luft, Linux, Windows and macOS, each one checked by a person before it reaches you."
  path="/categories/{data.slug}"
/>

<div class="page">
  <h1 class="mt-6 text-[32px] font-semibold tracking-[-0.03em] sm:mt-10 sm:text-[40px]">{data.name}</h1>
  <CategoryLinks categories={data.categories} current={data.name} class="mt-6" />
  <div class="mt-8">
    <AppGrid apps={data.apps} />
  </div>
</div>
