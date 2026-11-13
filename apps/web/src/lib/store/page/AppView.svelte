<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import Flag from "@lucide/svelte/icons/flag"
  import type { AppIndex, Installs, ProjectFile, ProjectSummary, System } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import { pickArtifact } from "../../system/artifacts.ts"
  import AppIcon from "../apps/AppIcon.svelte"
  import ExtensionArt from "../apps/ExtensionArt.svelte"
  import { categoryHref, categoryLabel, primaryCategory } from "../categories.ts"
  import ExtensionPermissions from "./access/ExtensionPermissions.svelte"
  import type { ExtensionGrant } from "./access/extension.ts"
  import Permissions from "./access/Permissions.svelte"
  import Privacy from "./access/Privacy.svelte"
  import Download from "./Download.svelte"
  import Facts from "./Facts.svelte"
  import OtherSystems from "./OtherSystems.svelte"
  import Releases from "./Releases.svelte"
  import Screenshots from "./Screenshots.svelte"

  let {
    app,
    installs,
    description,
    releases,
    system,
    extensionAccess,
    project,
    hasApp,
    parts,
  }: {
    app: AppIndex
    project: ProjectSummary
    hasApp: boolean
    parts: ProjectFile[]
    installs: Installs
    description: string
    releases: { version: string; published: string; notes: string }[]
    system: System
    extensionAccess: ExtensionGrant[] | null
  } = $props()

  const panel = $props.id()
  const listing = $derived(app.listing.en!)
  const latest = $derived(app.releases.find((release) => release.channel === "stable"))
  const testing = $derived(latest ? undefined : app.releases[0])
  const hosted = $derived(app.format === "files")
  const note = $derived(
    latest?.provenance.origin === "github-actions"
      ? "Every file is built on GitHub Actions and checked by Schelf."
      : "Every file was uploaded by the developer and checked by Schelf.",
  )
  const extension = $derived(app.kind === "extension")
  const primary = $derived(primaryCategory(app.categories))
  const artifacts = $derived(latest?.artifacts ?? [])
  const unavailable = $derived(
    !hasApp || (!extension && system.os !== "luft" && !pickArtifact(artifacts, system)),
  )
  let others = $state(false)
</script>

<article class="page">
  <header class="enter mt-6 flex flex-col gap-6 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
    <div class="flex items-center gap-5 sm:contents">
      {#if extension}
        <ExtensionArt art={app.screenshots[0]?.url ?? null} icon={app.icon} name={listing.name} width={256} eager class="h-20 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] sm:h-32" />
      {:else}
        <AppIcon src={app.icon} name={listing.name} eager class="size-20 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] sm:size-32" />
      {/if}
      <div class="min-w-0 flex-1">
        <h1 class="text-[32px] leading-none font-semibold tracking-[-0.03em] sm:text-[44px]">{listing.name}</h1>
        <p class="mt-2 text-ink-soft sm:mt-3 sm:text-lg">{listing.summary}</p>
        <p class="mt-1.5 text-[15px] text-ink-muted">
          <a href="/publishers/{app.publisher.slug}" class="inline-flex items-center gap-1 align-bottom hover:text-ink">
            {app.publisher.name}{#if app.publisher.verified}<BadgeCheck class="size-4 text-accent" aria-label="Verified publisher" />{/if}
          </a>
          {#if primary}
            · <a href={extension ? "/extensions" : categoryHref(primary)} class="hover:text-ink">{categoryLabel(primary)}</a>
          {/if}
          · {app.distribution === "open" ? "Free and open source" : "Closed source"}
        </p>
      </div>
    </div>
    {#if latest && !hasApp}
      <p class="text-[15px] text-ink-soft sm:text-right">{latest.version} · {date(latest.published)}</p>
    {:else if latest}
      <Download
        id={app.id}
        {extension}
        {artifacts}
        {system}
        {panel}
        inSchelf={project.listed && !hosted}
        bind:others
      />
    {:else}
      <div class="sm:text-right">
        <p class="font-medium">Coming soon</p>
        <p class="mt-1 text-[13px] text-ink-muted">
          {testing ? `${testing.version} is being tested on the ${testing.channel} channel.` : "The first release isn't out yet."}
        </p>
      </div>
    {/if}
  </header>

  {#if latest && !extension}
    <OtherSystems {artifacts} {parts} open={others || unavailable} id={panel} {note} />
  {/if}

  {#if app.screenshots.length}
    <div class="mt-10">
      <Screenshots screenshots={app.screenshots} name={listing.name} />
    </div>
  {/if}

  <div class="mt-6 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
    <div class="min-w-0">
      {#if description}
        <div class="prose prose-compact max-w-[42rem]">{@html description}</div>
      {/if}
      <Releases {releases} />
    </div>

    <aside class="space-y-8">
      {#if extensionAccess}
        <ExtensionPermissions grants={extensionAccess} />
      {:else if latest && !hosted}
        <Permissions permissions={latest.permissions} />
      {/if}
      {#if app.privacy}
        <Privacy privacy={app.privacy} />
      {/if}
      <Facts {app} {installs} />
      <a href="/report/{app.id}" class="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink">
        <Flag class="size-3.5" />
        Report a problem with this {extension ? "extension" : "app"}
      </a>
    </aside>
  </div>
</article>

