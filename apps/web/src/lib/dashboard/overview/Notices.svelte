<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right"
  import type { Notice } from "./attention.ts"

  let { notices }: { notices: Notice[] } = $props()
</script>

<ul class="divide-y divide-hairline overflow-hidden rounded-group bg-raised">
  {#each notices as notice (notice.title)}
    <li>
      <a href={notice.href} class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-well/50">
        <span class="size-2 shrink-0 rounded-full bg-caution"></span>
        <span class="min-w-0 flex-1">
          <span class="block font-medium">{notice.title}</span>
          <span class="block text-[15px] leading-relaxed text-ink-soft">{notice.text}</span>
        </span>
        <span class="flex shrink-0 items-center gap-1 text-[15px] text-ink-muted max-sm:sr-only">{notice.action}<ChevronRight class="size-4" /></span>
      </a>
    </li>
  {/each}
</ul>
