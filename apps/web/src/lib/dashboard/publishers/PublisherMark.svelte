<script lang="ts">
  let {
    logo,
    name,
    class: className = "size-8 text-[13px]",
  }: { logo: string | null; name: string; class?: string } = $props()
</script>

{#if logo}
  <img src={logo} alt="" class="shrink-0 rounded-[28%] object-cover {className}" decoding="async" />
{:else}
  <span aria-hidden="true" class="grid shrink-0 place-items-center rounded-[28%] bg-well font-semibold text-ink-soft {className}">{name.slice(0, 1)}</span>
{/if}
