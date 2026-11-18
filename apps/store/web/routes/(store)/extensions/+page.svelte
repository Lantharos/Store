<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import ExtensionGrid from "#lib/store/apps/ExtensionGrid.svelte"

  let { data } = $props()
</script>

<Meta
  title="Luft extensions · Schelf"
  description="Add to Luft's desktop: things drawn on the wallpaper, quick settings tiles, taskbar items, search providers and settings pages."
  path="/extensions"
/>

<div class="page">
  <section class="mt-6 max-w-2xl sm:mt-10">
    <h1 class="text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">Luft extensions</h1>
    <p class="mt-3 text-lg leading-relaxed text-ink-soft">
      Small additions to Luft's desktop: something on the wallpaper, a quick settings tile, a taskbar item, a search
      provider. You can remove one any time.
    </p>
  </section>
  <div class="mt-10">
    {#if data.extensions.length}
      <ExtensionGrid extensions={data.extensions} />
    {:else}
      <p class="text-ink-soft">The first extensions are on their way.</p>
    {/if}
  </div>
  <p class="mt-10 text-[15px] text-ink-muted">
    Making one? Start with <a href="https://docs.luft.computer" class="link">Luft's extension guide</a>, then
    <a href="/docs/luft-extensions" class="link">publish it here</a>.
  </p>
</div>
