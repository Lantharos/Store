<script lang="ts">
  import Check from "@lucide/svelte/icons/check"

  let { name, hex }: { name: string; hex: string } = $props()
  let copied = $state(false)
  let timer: ReturnType<typeof setTimeout>

  async function copy() {
    await navigator.clipboard.writeText(hex)
    copied = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied = false), 1600)
  }
</script>

<button type="button" onclick={copy} aria-label="Copy {name}, {hex}" class="group flex w-full items-center gap-3.5 rounded-2xl p-1.5 pr-3 text-left transition-colors hover:bg-well">
  <span class="grid size-12 shrink-0 place-items-center rounded-xl ring-1 ring-hairline ring-inset" style:background={hex}>
    {#if copied}<Check class="size-4 mix-blend-difference text-white" strokeWidth={2.5} />{/if}
  </span>
  <span class="min-w-0">
    <span class="block text-[15px] font-medium">{name}</span>
    <span class="block font-mono text-[13px] text-ink-muted">{copied ? "Copied" : hex}</span>
  </span>
</button>
