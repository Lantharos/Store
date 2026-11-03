<script lang="ts">
  import Check from "@lucide/svelte/icons/check"

  let { value = $bindable(null), label }: { value?: string | null; label: string } = $props()

  const SWATCHES = ["#e7e1d4", "#33405f", "#3e5d4a", "#7a3b2e", "#1d2a35", "#5b4a7a", "#b5852b", "#2f6f73"]
  let draft = $state(value ?? "")

  $effect(() => {
    draft = value ?? ""
  })

  function commit() {
    const hex = draft.trim().replace(/^#?/, "#").toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(hex)) value = hex
    else if (!draft.trim()) value = null
    else draft = value ?? ""
  }
</script>

<div class="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
  <button
    type="button"
    aria-pressed={value === null}
    onclick={() => (value = null)}
    class="grid size-8 place-items-center rounded-full bg-well text-[11px] text-ink-muted ring-offset-2 ring-offset-canvas {value === null ? 'ring-2 ring-accent' : ''}"
    title="None"
  >
    {#if value === null}<Check class="size-3.5" />{:else}–{/if}
  </button>
  {#each SWATCHES as swatch (swatch)}
    <button
      type="button"
      aria-label={swatch}
      aria-pressed={value === swatch}
      onclick={() => (value = swatch)}
      class="size-8 rounded-full ring-offset-2 ring-offset-canvas transition-transform hover:scale-110 {value === swatch ? 'ring-2 ring-accent' : ''}"
      style:background={swatch}
    ></button>
  {/each}
  <label class="field ml-1 flex h-8 w-32 items-center gap-2 rounded-full px-3 text-[13px]">
    <span class="size-3.5 shrink-0 rounded-full ring-1 ring-hairline" style:background={value ?? "transparent"}></span>
    <input bind:value={draft} onblur={commit} onkeydown={(event) => event.key === "Enter" && (event.preventDefault(), commit())} placeholder="#hex" aria-label="{label} as hex" class="w-full bg-transparent font-mono outline-none" />
  </label>
</div>
