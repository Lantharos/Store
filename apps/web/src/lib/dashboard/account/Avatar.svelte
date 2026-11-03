<script lang="ts">
  let {
    src,
    name,
    class: className = "size-9 text-[15px]",
  }: { src: string | null; name: string; class?: string } = $props()
  let failed = $state<string | null>(null)
</script>

<span aria-hidden="true" class="grid shrink-0 place-items-center overflow-hidden rounded-full bg-well font-semibold text-ink-soft {className}">
  {#if src && failed !== src}
    <img {src} alt="" class="size-full object-cover" decoding="async" onerror={() => (failed = src)} />
  {:else}
    {name.slice(0, 1).toUpperCase()}
  {/if}
</span>
