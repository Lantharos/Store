<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right"
  import Plus from "@lucide/svelte/icons/plus"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PendingInvites from "#lib/dashboard/publishers/PendingInvites.svelte"
  import { RELEASE_STATUS, TONE_DOT } from "#lib/dashboard/releases/status.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import { count } from "#lib/format.ts"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import ExtensionArt from "#lib/store/apps/ExtensionArt.svelte"

  const attention = $derived(
    session.apps.filter(
      (app) => app.release_status && RELEASE_STATUS[app.release_status].tone === "attention",
    ),
  )
</script>

<PageHeader title={session.publisher?.kind === "person" ? "Your projects" : `${session.publisher?.name}'s projects`}>
  {#snippet actions()}
    {#if session.can("apps")}
      <a href="/dashboard/apps/new" class="button button-quiet">Add an app</a>
      <a href="/dashboard/projects/new" class="button button-primary"><Plus class="size-4" />New project</a>
    {/if}
  {/snippet}
</PageHeader>

<div class="mt-6 empty:hidden"><PendingInvites /></div>

{#each attention as app (app.id)}
  <a href="/dashboard/apps/{app.id}" class="enter group mt-6 flex items-center gap-4 rounded-2xl bg-[color-mix(in_oklab,var(--danger)_9%,var(--canvas))] p-4">
    <AppIcon src={app.icon} name={app.name} class="size-10" />
    <span class="min-w-0 flex-1">
      <span class="block font-medium">{app.name} needs you</span>
      <span class="block text-[15px] text-ink-soft">The latest release is {RELEASE_STATUS[app.release_status!].label.toLowerCase()}. See what to change.</span>
    </span>
    <ArrowRight class="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5" />
  </a>
{/each}

{#if session.apps.length}
  <ul class="mt-8 divide-y divide-hairline overflow-hidden rounded-group bg-raised">
    <li class="hidden grid-cols-[minmax(0,1fr)_7rem_13rem_8rem] gap-4 px-5 pt-4 pb-2.5 text-[13px] text-ink-muted md:grid" aria-hidden="true">
      <span>Project</span><span>Version</span><span>Latest release</span><span class="text-right">Downloads this week</span>
    </li>
    {#each session.apps as app, index (app.id)}
      {@const status = app.release_status ? RELEASE_STATUS[app.release_status] : null}
      <li class="enter" style:--order={index}>
        <a href="/dashboard/apps/{app.id}" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-well/50 md:grid-cols-[minmax(0,1fr)_7rem_13rem_8rem]">
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
{:else}
  <section class="enter mt-8 grid gap-4 lg:grid-cols-2">
    <div class="rounded-group bg-raised p-7 sm:p-9">
      <h2 class="text-2xl font-semibold tracking-[-0.02em]">Host your releases</h2>
      <p class="mt-2 leading-relaxed text-ink-soft">Any app, open or closed source, on any system. Send releases from GitHub Actions or upload them, and point your site's download button at Schelf. It stays unlisted until you ask to list it.</p>
      {#if session.can("apps")}<a href="/dashboard/projects/new" class="button button-primary mt-6">New project</a>{/if}
    </div>
    <div class="rounded-group bg-raised p-7 sm:p-9">
      <h2 class="text-2xl font-semibold tracking-[-0.02em]">Put an app in the store</h2>
      <p class="mt-2 leading-relaxed text-ink-soft">Sabine apps, AppImages and Luft extensions, listed in the catalog and the Schelf app on Luft, with a person reviewing every release.</p>
      {#if session.can("apps")}<a href="/dashboard/apps/new" class="button button-quiet mt-6">Add an app</a>{/if}
    </div>
  </section>
{/if}
