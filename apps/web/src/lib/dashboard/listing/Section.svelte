<script lang="ts">
  import type { Snippet } from "svelte"

  let { title, text, aside, children }: { title: string; text?: string; aside?: Snippet; children: Snippet } =
    $props()
</script>

<section>
  <div class="mb-2.5 flex flex-wrap items-end justify-between gap-4 px-1">
    <div>
      <h2 class="font-semibold">{title}</h2>
      {#if text}<p class="mt-0.5 max-w-lg text-[13px] leading-relaxed text-ink-muted">{text}</p>{/if}
    </div>
    {#if aside}{@render aside()}{/if}
  </div>
  <div class="space-y-6 rounded-group bg-raised p-5 sm:p-6">{@render children()}</div>
</section>
