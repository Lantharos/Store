<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    open = $bindable(false),
    children,
  }: { title: string; description?: string; open?: boolean; children: Snippet } = $props()
  const id = $props.id()
</script>

<section class="overflow-hidden rounded-group bg-raised">
  <button type="button" class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-well/40" aria-expanded={open} aria-controls={id} onclick={() => (open = !open)}>
    <span class="min-w-0 flex-1">
      <span class="block font-medium">{title}</span>
      {#if description}<span class="block text-[13px] leading-relaxed text-ink-muted">{description}</span>{/if}
    </span>
    <ChevronDown class="size-4 shrink-0 text-ink-muted transition-transform {open ? 'rotate-180' : ''}" />
  </button>
  {#if open}<div {id} class="border-t border-hairline">{@render children()}</div>{/if}
</section>
