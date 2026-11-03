<script lang="ts">
  let {
    logo,
    name,
    person = false,
    class: className = "size-8 text-[13px]",
  }: { logo: string | null; name: string; person?: boolean; class?: string } = $props()
  const shape = $derived(person ? "rounded-full" : "rounded-[28%]")
</script>

{#if logo}
  <img src={logo} alt="" class="shrink-0 bg-well object-cover {shape} {className}" decoding="async" />
{:else}
  <span aria-hidden="true" class="grid shrink-0 place-items-center bg-well font-semibold text-ink-soft {shape} {className}">{name.slice(0, 1)}</span>
{/if}
