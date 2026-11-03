<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import Copy from "@lucide/svelte/icons/copy"

  let { text, label = "Copy", class: className = "" }: { text: string; label?: string; class?: string } = $props()
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
  class="button button-sm button-quiet {className}"
>
  {#if copied}
    <Check class="size-3.5 text-accent" strokeWidth={2.5} />
    Copied
  {:else}
    <Copy class="size-3.5" />
    {label}
  {/if}
</button>
