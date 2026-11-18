<script lang="ts">
  let {
    src,
    name,
    class: className = "size-14",
    eager = false,
  }: { src: string | null; name: string; class?: string; eager?: boolean } = $props()
</script>

{#if src}
  <img {src} alt="" class="app-icon {className}" loading={eager ? "eager" : "lazy"} decoding="async" />
{:else}
  <span aria-hidden="true" class="app-icon grid place-items-center bg-well font-semibold text-ink-soft {className}">
    {name.slice(0, 1)}
  </span>
{/if}
