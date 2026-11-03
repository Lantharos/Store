<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    text,
    icon,
    action,
    children,
  }: { title: string; text: string; icon: Snippet; action?: Snippet; children?: Snippet } = $props()
</script>

<div class="py-4">
  <div class="flex items-center gap-4">
    <span class="grid size-5 shrink-0 place-items-center text-ink-muted">{@render icon()}</span>
    <div class="min-w-0 flex-1">
      <p class="font-medium">{title}</p>
      <p class="text-[15px] text-ink-muted">{text}</p>
    </div>
    {#if action}<div class="shrink-0">{@render action()}</div>{/if}
  </div>
  {#if children}<div class="mt-2 pl-9">{@render children()}</div>{/if}
</div>
