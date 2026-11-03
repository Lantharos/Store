<script lang="ts">
  import type { Snippet } from "svelte"

  let { title, text, aside, children }: { title: string; text?: string; aside?: Snippet; children: Snippet } =
    $props()
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold">{title}</h2>
      {#if text}<p class="mt-1 max-w-lg text-[15px] leading-relaxed text-ink-muted">{text}</p>{/if}
    </div>
    {#if aside}{@render aside()}{/if}
  </div>
  {@render children()}
</section>
