<script lang="ts">
  import type { ReleaseDetail } from "@schelf/protocol"
  import { ago } from "../../format.ts"

  let { release, href }: { release: ReleaseDetail; href?: string } = $props()
</script>

<div class="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
  <h2 class="text-xl font-semibold tabular">
    {#if href}<a {href} class="hover:underline">{release.version}</a>{:else}{release.version}{/if}
  </h2>
  <p class="text-[15px] text-ink-muted">
    {#if release.tag}Tagged <span class="font-mono text-[13px]">{release.tag}</span>{" · "}{/if}{#if release.commit}<span class="font-mono text-[13px]">{release.commit.slice(0, 7)}</span>{" · "}{/if}{ago(release.created_at)}
  </p>
</div>
