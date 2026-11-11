<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import type { ReleaseSummary } from "@schelf/protocol"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import InsideLuft from "#lib/dashboard/releases/InsideLuft.svelte"
  import Promote from "#lib/dashboard/releases/Promote.svelte"
  import ReleaseFiles from "#lib/dashboard/releases/ReleaseFiles.svelte"
  import ReleaseHeader from "#lib/dashboard/releases/ReleaseHeader.svelte"
  import { previousShipped, releaseDetail } from "#lib/dashboard/releases/release.svelte.ts"
  import Timeline from "#lib/dashboard/releases/Timeline.svelte"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import { page } from "$app/state"

  const id = $derived(page.params.id!)
  const releaseId = $derived(page.params.release!)
  const detail = $derived(releaseDetail(id, releaseId))
  const releases = $derived(resource<ReleaseSummary[]>(endpoints.releases(id)))
  const settings = $derived(appSettings()())
</script>

<svelte:head><title>{detail.data ? `${detail.data.version} · ` : ""}Schelf for developers</title></svelte:head>

<a href="/dashboard/apps/{id}" class="inline-flex items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink"><ArrowLeft class="size-4" />All releases</a>

<div class="mt-4">
  {#if detail.error}
    <Failed error={detail.error} retry={() => detail.refresh()} />
  {:else if !detail.data}
    <Loading />
  {:else}
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Timeline appId={id} release={detail.data} previous={releases.data ? previousShipped(releases.data, releaseId) : null} onchange={(next) => detail.set(next)}>
        {#snippet header()}<ReleaseHeader release={detail.data!} />{/snippet}
      </Timeline>
      <div class="space-y-6">
        {#if detail.data.shell}
          <InsideLuft appId={id} release={detail.data} shell={detail.data.shell} onchange={(next) => detail.set(next)} />
        {/if}
        {#if settings.data && (detail.data.status === "live" || detail.data.status === "rolling-out") && session.can("releases")}
          <Promote settings={settings.data} release={detail.data} />
        {/if}
        <ReleaseFiles release={detail.data} />
      </div>
    </div>
  {/if}
</div>
