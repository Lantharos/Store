<script lang="ts">
  import type { ReleaseSummary } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import { RELEASE_STATUS, TONE_DOT } from "./status.ts"

  let { appId, releases }: { appId: string; releases: ReleaseSummary[] } = $props()
</script>

<ul class="divide-y divide-hairline">
  {#each releases as release (release.id)}
    {@const status = RELEASE_STATUS[release.status]}
    <li>
      <a href="/dashboard/apps/{appId}/releases/{encodeURIComponent(release.id)}" class="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-3 text-[15px] transition-colors hover:bg-well/50">
        <span class="font-medium tabular">{release.version}</span>
        <span class="flex items-center gap-2 text-ink-soft"><span class="size-2 shrink-0 rounded-full {TONE_DOT[status.tone]}"></span><span class="truncate">{status.label}</span></span>
        <time datetime={release.created_at} class="text-ink-muted">{date(release.created_at)}</time>
      </a>
    </li>
  {/each}
</ul>
