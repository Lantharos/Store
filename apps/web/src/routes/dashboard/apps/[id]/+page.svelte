<script lang="ts">
  import type { ReleaseSummary } from "@schelf/protocol"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import { notices } from "#lib/dashboard/overview/attention.ts"
  import DownloadLink from "#lib/dashboard/overview/DownloadLink.svelte"
  import FirstRelease from "#lib/dashboard/overview/FirstRelease.svelte"
  import NextRelease from "#lib/dashboard/overview/NextRelease.svelte"
  import Notices from "#lib/dashboard/overview/Notices.svelte"
  import ReleaseHeader from "#lib/dashboard/releases/ReleaseHeader.svelte"
  import ReleaseList from "#lib/dashboard/releases/ReleaseList.svelte"
  import { previousShipped, releaseDetail } from "#lib/dashboard/releases/release.svelte.ts"
  import Timeline from "#lib/dashboard/releases/Timeline.svelte"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import { page } from "$app/state"

  const id = $derived(page.params.id!)
  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
  const releases = $derived(resource<ReleaseSummary[]>(endpoints.releases(id)))
  const featured = $derived(
    releases.data?.find((release) => release.status === "rolling-out") ?? releases.data?.[0],
  )
  const detail = $derived(featured ? releaseDetail(id, featured.id) : null)
  const others = $derived(releases.data?.filter((release) => release.id !== featured?.id) ?? [])
  const shipped = $derived(
    releases.data?.find((release) => release.status === "live" || release.status === "rolling-out"),
  )
  const attention = $derived(notices(data, releases.data ?? []))
</script>

<svelte:head><title>{data.app.name} · Schelf for developers</title></svelte:head>

{#if releases.error}
  <Failed error={releases.error} retry={() => releases.refresh()} />
{:else if !releases.data}
  <Loading />
{:else}
  <div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="min-w-0 space-y-10">
      {#if attention.length}<Notices notices={attention} />{/if}

      {#if !featured}
        <section>
          <h2 class="text-xl font-semibold">Send the first release</h2>
          <div class="mt-6"><FirstRelease settings={data} /></div>
        </section>
      {:else}
        {#if detail?.data}
          <Timeline appId={id} release={detail.data} previous={previousShipped(releases.data, featured.id)} onchange={(next) => detail.set(next)}>
            {#snippet header()}<ReleaseHeader release={detail.data!} href="/dashboard/apps/{id}/releases/{encodeURIComponent(featured.id)}" />{/snippet}
          </Timeline>
        {:else if detail?.error}
          <Failed error={detail.error} retry={() => detail.refresh()} />
        {:else}
          <div class="placeholder h-96 rounded-group"></div>
        {/if}

        {#if others.length}
          <section>
            <h2 class="mb-2.5 px-1 font-semibold">Other releases</h2>
            <ReleaseList appId={id} releases={others} switches={data.switches} />
          </section>
        {/if}
      {/if}
    </div>

    <aside class="space-y-8">
      <DownloadLink settings={data} />
      {#if featured}<NextRelease settings={data} version={shipped?.version ?? featured.version} />{/if}
    </aside>
  </div>
{/if}
