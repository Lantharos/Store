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
  class="flex h-10 items-center gap-3 rounded-xl pr-2 pl-3 text-ink-soft transition-colors hover:bg-well/60 hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink"
>
  <Icon class="size-[18px] shrink-0" />
  <span class="truncate">{@render children()}</span>
</a>
