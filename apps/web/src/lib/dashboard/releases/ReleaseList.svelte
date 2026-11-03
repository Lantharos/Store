<script lang="ts">
  import type { ReleaseSummary, UpdaterSwitch } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import { frameworkName } from "../hosting/framework.ts"
  import { RELEASE_STATUS, TONE_DOT } from "./status.ts"

  let {
    appId,
    releases,
    switches = [],
  }: { appId: string; releases: ReleaseSummary[]; switches?: UpdaterSwitch[] } = $props()
  const movedAt = $derived(
    new Map(switches.flatMap((entry) => (entry.first_release ? [[entry.first_release, entry]] : []))),
  )
</script>

<ul class="divide-y divide-hairline overflow-hidden rounded-group bg-raised">
  {#each releases as release (release.id)}
    {@const status = RELEASE_STATUS[release.status]}
    {@const move = movedAt.get(release.id)}
    {#if move}
      <li class="bg-well/40 px-5 py-2.5 text-[13px] text-ink-soft">Moved from {frameworkName(move.from)} to {frameworkName(move.to)} here</li>
    {/if}
    <li>
      <a href="/dashboard/apps/{appId}/releases/{encodeURIComponent(release.id)}" class="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-[15px] transition-colors hover:bg-well/50">
        <span class="min-w-0 truncate font-medium tabular">{release.version}{#if release.channel !== "stable"}<span class="ml-1.5 font-normal text-ink-muted">{release.channel}</span>{/if}{#if release.bridge}<span class="ml-1.5 font-normal text-ink-muted">bridge</span>{/if}</span>
        <span class="flex items-center gap-2 text-ink-soft"><span class="size-2 shrink-0 rounded-full {TONE_DOT[status.tone]}"></span><span class="truncate">{status.label}</span></span>
        <time datetime={release.created_at} class="text-ink-muted">{date(release.created_at)}</time>
      </a>
    </li>
  {/each}
</ul>
