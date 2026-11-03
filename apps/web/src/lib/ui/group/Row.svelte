<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    leading,
    children,
    below,
  }: {
    title: string
    description?: string | null
    leading?: Snippet
    children?: Snippet
    below?: Snippet
  } = $props()
</script>

<div class="px-5 py-3.5">
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 {children ? 'min-h-9' : ''}">
    {#if leading}<div class="flex shrink-0 items-center text-ink-muted">{@render leading()}</div>{/if}
    <div class="min-w-0 flex-[1_1_12rem]">
      <p class="font-medium break-words">{title}</p>
      {#if description}<p class="text-[13px] leading-relaxed text-ink-muted">{description}</p>{/if}
    </div>
    {#if children}<div class="ml-auto flex max-w-full shrink-0 items-center gap-2">{@render children()}</div>{/if}
  </div>
  {#if below}<div class="mt-1.5">{@render below()}</div>{/if}
</div>
