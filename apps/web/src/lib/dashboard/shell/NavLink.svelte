<script lang="ts">
  import type { Component, Snippet } from "svelte"

  let {
    href,
    current = false,
    icon: Icon,
    children,
  }: { href: string; current?: boolean; icon: Component<{ class?: string }>; children: Snippet } = $props()
</script>

<a
  {href}
  aria-current={current ? "page" : undefined}
  class="flex items-center gap-3 rounded-xl px-2 py-1.5 text-ink-soft transition-colors hover:bg-well/60 hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink"
>
  <span class="grid size-7 shrink-0 place-items-center"><Icon class="size-4" /></span>
  <span class="truncate">{@render children()}</span>
</a>
