<script lang="ts">
  import type { ReleaseDetail } from "@schelf/protocol"
  import { ago } from "../../format.ts"

  let { release, href }: { release: ReleaseDetail; href?: string } = $props()
</script>

{#if release.bridge}
  <p class="mb-3 text-[15px] text-ink-soft">The bridge: the last build made the old way, handing over to the new one.</p>
{/if}
<div class="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
  <h2 class="text-xl font-semibold tabular">
    {#if href}<a {href} class="hover:underline">{release.version}</a>{:else}{release.version}{/if}
    {#if release.channel !== "stable"}<span class="ml-1.5 text-[15px] font-normal text-ink-muted">on {release.channel}</span>{/if}
  </h2>
  <p class="text-[15px] text-ink-muted">
    {#if release.tag}Tagged <span class="font-mono text-[13px]">{release.tag}</span>{" · "}{/if}{#if release.commit}<span class="font-mono text-[13px]">{release.commit.slice(0, 7)}</span>{" · "}{/if}{ago(release.created_at)}
  </p>
</div>
