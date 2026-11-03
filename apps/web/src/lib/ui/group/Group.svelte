<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    rows = false,
    actions,
    class: className = "",
    children,
  }: {
    title?: string
    description?: string
    rows?: boolean
    actions?: Snippet
    class?: string
    children: Snippet
  } = $props()
</script>

<section class={className}>
  {#if title || actions}
    <div class="mb-2.5 flex items-end justify-between gap-4 px-1">
      <div class="min-w-0">
        {#if title}<h2 class="font-semibold">{title}</h2>{/if}
        {#if description}<p class="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>{/if}
      </div>
      {#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
    </div>
  {/if}
  <div class="overflow-hidden rounded-group bg-raised {rows ? 'divide-y divide-hairline' : 'space-y-6 p-5 sm:p-6'}">
    {@render children()}
  </div>
</section>
