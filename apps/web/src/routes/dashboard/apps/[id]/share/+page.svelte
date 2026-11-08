<script lang="ts">
  import type { ReleaseSummary } from "@schelf/protocol"
  import BadgeBuilder from "#lib/brand/BadgeBuilder.svelte"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import { releaseDetail } from "#lib/dashboard/releases/release.svelte.ts"
  import Checksums from "#lib/dashboard/share/Checksums.svelte"
  import EmbedButton from "#lib/dashboard/share/EmbedButton.svelte"
  import MainLink from "#lib/dashboard/share/MainLink.svelte"
  import SystemLinks from "#lib/dashboard/share/SystemLinks.svelte"
  import { channelLink, linkedRelease } from "#lib/dashboard/share/shipped.ts"
  import Segmented from "#lib/ui/fields/Segmented.svelte"
  import { page } from "$app/state"

  const id = $derived(page.params.id!)
  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
  const releases = $derived(resource<ReleaseSummary[]>(endpoints.releases(id)))
  let channel = $state("stable")
  const channels = $derived(
    data.channels.filter((entry) => entry.releases > 0 && !entry.ended_into).map((entry) => entry.name),
  )
  const shipped = $derived(
    releases.data ? linkedRelease(releases.data, channel, data.app.latest_follows_rollout) : undefined,
  )
  const detail = $derived(shipped ? releaseDetail(id, shipped.id) : null)
  const latest = $derived(channelLink(data.links.latest, channel))
</script>

<svelte:head><title>Share · {data.app.name} · Schelf for developers</title></svelte:head>

<div class="max-w-3xl space-y-10">
  {#if channels.length > 1}
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="px-1 text-[15px] text-ink-soft">{channel === "stable" ? "Links for everyone" : `Links for people on ${channel}`}</p>
      <Segmented bind:value={channel} label="Channel" size="sm" options={channels.map((name) => ({ value: name, label: name[0]!.toUpperCase() + name.slice(1) }))} />
    </div>
  {/if}

  <MainLink link={latest} page={data.links.page} released={shipped !== undefined} />

  {#if detail?.data}
    <div class="space-y-3">
      <SystemLinks {latest} release={detail.data} />
      <Checksums {latest} release={detail.data} />
    </div>
  {/if}

  <EmbedButton code={data.links.embed} release={detail?.data} />

  <section>
    <h2 class="px-1 font-semibold">A badge for your site</h2>
    <p class="mt-0.5 px-1 text-[13px] leading-relaxed text-ink-muted">Sends people to {data.app.name}’s page on Schelf. The logo and colours are on the <a href="/brand" class="link">brand page</a>.</p>
    <div class="mt-2.5 rounded-group bg-raised p-5"><BadgeBuilder link={data.links.page} /></div>
  </section>
</div>
