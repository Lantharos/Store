<script lang="ts">
  import type { Snippet } from "svelte"

  let { title, text, actions }: { title: string; text?: string; actions?: Snippet } = $props()
</script>

<svelte:head><title>{title} · Schelf for developers</title></svelte:head>

<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
    {#if text}<p class="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{text}</p>{/if}
  </div>
  {#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
</header>
