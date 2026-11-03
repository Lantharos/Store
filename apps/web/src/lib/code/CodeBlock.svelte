<script lang="ts">
  import CopyButton from "./CopyButton.svelte"
  import { highlight, type Language } from "./highlight.ts"

  let { code, lang, title }: { code: string; lang: Language; title?: string } = $props()
  let html = $state<string>()

  $effect(() => {
    const source = code
    void highlight(source.trimEnd(), lang).then((result) => {
      if (source === code) html = result
    })
  })
</script>

<figure class="overflow-hidden rounded-2xl bg-[color-mix(in_oklab,var(--well)_55%,var(--canvas))]">
  <figcaption class="flex items-center justify-between gap-3 py-2 pr-2 pl-4">
    <span class="truncate font-mono text-[13px] text-ink-muted">{title ?? ""}</span>
    <CopyButton text={code} label={title ? "Copy" : "Copy command"} />
  </figcaption>
  <div class="code overflow-x-auto px-4 pb-4 font-mono text-[13px] leading-relaxed text-ink-soft">
    {#if html}{@html html}{:else}<pre>{code.trimEnd()}</pre>{/if}
  </div>
</figure>

<style>
  .code :global(pre) {
    background: transparent !important;
  }
</style>
