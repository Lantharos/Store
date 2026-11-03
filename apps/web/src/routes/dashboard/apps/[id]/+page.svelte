<script lang="ts">
  import type { ReleaseSummary } from "@schelf/protocol"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import FirstRelease from "#lib/dashboard/apps/FirstRelease.svelte"
  import FirstUpload from "#lib/dashboard/apps/FirstUpload.svelte"
  import NextRelease from "#lib/dashboard/apps/NextRelease.svelte"
  import WhereItGoes from "#lib/dashboard/apps/WhereItGoes.svelte"
  import ReleaseHeader from "#lib/dashboard/releases/ReleaseHeader.svelte"
  import ReleaseList from "#lib/dashboard/releases/ReleaseList.svelte"
  import { previousShipped, releaseDetail } from "#lib/dashboard/releases/release.svelte.ts"
  import Timeline from "#lib/dashboard/releases/Timeline.svelte"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import { page } from "$app/state"

  const id = $derived(page.params.id!)
  const settings = $derived(appSettings()())
  const releases = $derived(resource<ReleaseSummary[]>(endpoints.releases(id)))
  const latest = $derived(releases.data?.[0])
  const detail = $derived(latest ? releaseDetail(id, latest.id) : null)
  const rolling = $derived(
    releases.data?.find((release) => release.status === "rolling-out" && release.id !== latest?.id),
  )
  const rollingDetail = $derived(rolling ? releaseDetail(id, rolling.id) : null)
  const app = $derived(settings.data!.app)
</script>

<svelte:head><title>{app.name} · Schelf for developers</title></svelte:head>

{#if releases.error}
  <Failed error={releases.error} retry={() => releases.refresh()} />
{:else if !releases.data}
  <Loading />
{:else if !latest}
  {#if app.format === "files"}<FirstUpload settings={settings.data!} />{:else}<FirstRelease settings={settings.data!} />{/if}
{:else}
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="min-w-0">
      {#if detail?.data}
        <Timeline appId={id} release={detail.data} previous={previousShipped(releases.data, latest.id)} onchange={(next) => detail.set(next)}>
          {#snippet header()}<ReleaseHeader release={detail.data!} href="/dashboard/apps/{id}/releases/{encodeURIComponent(latest.id)}" />{/snippet}
        </Timeline>
      {:else if detail?.error}
        <Failed error={detail.error} retry={() => detail.refresh()} />
      {:else}
        <div class="placeholder h-96 rounded-group"></div>
      {/if}

      {#if rolling && rollingDetail?.data}
        <h2 class="mt-10 mb-2.5 px-1 font-semibold">Rolling out now</h2>
        <Timeline appId={id} release={rollingDetail.data} previous={previousShipped(releases.data, rolling.id)} onchange={(next) => rollingDetail.set(next)}>
          {#snippet header()}<ReleaseHeader release={rollingDetail.data!} href="/dashboard/apps/{id}/releases/{encodeURIComponent(rolling.id)}" />{/snippet}
        </Timeline>
      {/if}

      {#if releases.data.length > 1}
        <section class="mt-10">
          <h2 class="px-1 font-semibold">Earlier releases</h2>
          <div class="mt-2.5"><ReleaseList appId={id} releases={releases.data.slice(1)} switches={settings.data!.switches} /></div>
        </section>
      {/if}
    </div>
    <div class="space-y-6">
      <NextRelease {app} version={releases.data.find((release) => release.status === "live" || release.status === "rolling-out")?.version ?? latest.version} />
      <WhereItGoes settings={settings.data!} />
    </div>
  </div>
{/if}
