<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import Copy from "@lucide/svelte/icons/copy"

  let {
    text,
    label = "Copy",
    compact = false,
    primary = false,
    class: className = "",
  }: { text: string; label?: string; compact?: boolean; primary?: boolean; class?: string } = $props()
  let copied = $state(false)
  let timer: ReturnType<typeof setTimeout>

  async function copy() {
    await navigator.clipboard.writeText(text)
    copied = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied = false), 1600)
  }
</script>

<button
  type="button"
  onclick={copy}
  aria-label={copied ? "Copied" : label}
  title={compact ? label : undefined}
  class="button shrink-0 {primary ? 'button-primary' : 'button-sm button-quiet'} {compact ? 'w-8 px-0' : ''} {className}"
>
  {#if copied}
    <Check class="size-3.5 {primary ? '' : 'text-accent'}" strokeWidth={2.5} />
    {#if !compact}Copied{/if}
  {:else}
    <Copy class="size-3.5" />
    {#if !compact}{label}{/if}
  {/if}
</button>
