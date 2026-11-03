<script lang="ts">
  import Flag from "@lucide/svelte/icons/flag"
  import type { AppIndex, Installs } from "@schelf/protocol"
  import { pickArtifact } from "../../system/artifacts.ts"
  import type { System } from "../../system/detect.ts"
  import AppIcon from "../apps/AppIcon.svelte"
  import { categoryHref, categoryLabel } from "../categories.ts"
  import Download from "./Download.svelte"
  import Facts from "./Facts.svelte"
  import OtherSystems from "./OtherSystems.svelte"
  import Permissions from "./Permissions.svelte"
  import Releases from "./Releases.svelte"
  import Screenshots from "./Screenshots.svelte"

  let {
    app,
    installs,
    description,
    releases,
    system,
  }: {
    app: AppIndex
    installs: Installs
    description: string
    releases: { version: string; published: string; notes: string }[]
    system: System
  } = $props()

  const panel = $props.id()
  const listing = $derived(app.listing.en!)
  const latest = $derived(app.releases[0])
  const extension = $derived(app.kind === "extension")
  const artifacts = $derived(latest?.artifacts ?? [])
  const unavailable = $derived(!extension && system.os !== "luft" && !pickArtifact(artifacts, system))
  let others = $state(false)
</script>

<article class="page">
  <header class="enter mt-6 flex flex-col gap-6 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
    <div class="flex items-center gap-5 sm:contents">
      <AppIcon src={app.icon} name={listing.name} eager class="size-20 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] sm:size-32" />
      <div class="min-w-0 flex-1">
        <h1 class="text-[32px] leading-none font-semibold tracking-[-0.03em] sm:text-[44px]">{listing.name}</h1>
        <p class="mt-2 text-ink-soft sm:mt-3 sm:text-lg">{listing.summary}</p>
        <p class="mt-1.5 text-[15px] text-ink-muted">
          <a href="/developers/{app.developer.slug}" class="hover:text-ink">{app.developer.name}</a>
          {#each app.categories.slice(0, 1) as category (category)}
            · <a href={extension ? "/extensions" : categoryHref(category)} class="hover:text-ink">{categoryLabel(category)}</a>
          {/each}
          {#if app.distribution === "open"}· Free and open source{/if}
        </p>
      </div>
    </div>
    {#if latest}
      <Download id={app.id} {extension} {artifacts} {system} {panel} bind:others />
    {:else}
      <div class="sm:text-right">
        <p class="font-medium">Coming soon</p>
        <p class="mt-1 text-[13px] text-ink-muted">The first release is being checked.</p>
      </div>
    {/if}
  </header>

  {#if latest && !extension}
    <OtherSystems {artifacts} open={others || unavailable} id={panel} />
  {/if}

  {#if app.screenshots.length}
    <div class="mt-10">
      <Screenshots screenshots={app.screenshots} name={listing.name} />
    </div>
  {/if}

  <div class="mt-6 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
    <div class="min-w-0">
      {#if description}
        <div class="description max-w-[42rem] text-[17px] leading-relaxed text-ink-soft">{@html description}</div>
      {/if}
      <Releases {releases} />
    </div>

    <aside class="space-y-8">
      {#if latest}<Permissions permissions={latest.permissions} {extension} />{/if}
      <Facts {app} {installs} />
      <a href="/report/{app.id}" class="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink">
        <Flag class="size-3.5" />
        Report a problem with this {extension ? "extension" : "app"}
      </a>
    </aside>
  </div>
</article>

<style>
  .description :global(p + p),
  .description :global(* + ul),
  .description :global(ul + p) {
    margin-top: 1em;
  }

  .description :global(ul) {
    list-style: disc;
    padding-left: 1.25rem;
  }

  .description :global(a) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .description :global(h1),
  .description :global(h2),
  .description :global(h3) {
    margin-top: 1.5em;
    color: var(--ink);
    font-size: 1.125rem;
    font-weight: 600;
  }
</style>
