<script lang="ts">
  import type { DashboardApp } from "@schelf/protocol"
  import { count } from "#lib/format.ts"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import ExtensionArt from "#lib/store/apps/ExtensionArt.svelte"
  import { RELEASE_STATUS, TONE_DOT } from "../releases/status.ts"

  let { apps }: { apps: DashboardApp[] } = $props()
</script>

<ul class="divide-y divide-hairline overflow-hidden rounded-group bg-raised">
  <li class="hidden grid-cols-[minmax(0,1fr)_7rem_13rem_11rem] gap-4 px-5 pt-4 pb-2.5 text-[13px] text-ink-muted md:grid" aria-hidden="true">
    <span>Project</span><span>Version</span><span>Latest release</span><span class="text-right">Downloads this week</span>
  </li>
  {#each apps as app, index (app.id)}
    {@const status = app.release_status ? RELEASE_STATUS[app.release_status] : null}
    <li class="enter" style:--order={index}>
      <a href="/dashboard/apps/{app.id}" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-well/50 md:grid-cols-[minmax(0,1fr)_7rem_13rem_11rem]">
        <span class="flex min-w-0 items-center gap-4">
          {#if app.kind === "extension"}
            <ExtensionArt art={app.art} icon={app.icon} name={app.name} width={88} class="h-11" />
          {:else}
            <AppIcon src={app.icon} name={app.name} class="size-11" />
          {/if}
          <span class="min-w-0">
            <span class="block truncate font-medium">{app.name}</span>
            <span class="block truncate font-mono text-[13px] text-ink-muted">{app.publisher_slug}/{app.slug}{app.visibility === "unlisted" ? " · unlisted" : ""}</span>
          </span>
        </span>
        <span class="text-[15px] tabular text-ink-soft max-md:text-right">{app.version ?? "–"}</span>
        <span class="flex items-center gap-2 text-[15px] text-ink-soft max-md:col-start-1 {app.kind === 'extension' ? 'max-md:pl-26' : 'max-md:pl-15'}">
          {#if status}
            <span class="size-2 shrink-0 rounded-full {TONE_DOT[status.tone]}"></span><span class="truncate">{status.label}</span>
          {:else}
            <span class="size-2 shrink-0 rounded-full bg-ink-muted/40"></span>No release yet
          {/if}
        </span>
        <span class="text-right text-[15px] tabular text-ink-soft max-md:row-start-2 max-md:col-start-2">{count(app.installs_7d)}</span>
      </a>
    </li>
  {/each}
</ul>
