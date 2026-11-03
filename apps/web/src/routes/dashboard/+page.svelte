<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right"
  import Plus from "@lucide/svelte/icons/plus"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PendingInvites from "#lib/dashboard/publishers/PendingInvites.svelte"
  import { RELEASE_STATUS, TONE_DOT } from "#lib/dashboard/releases/status.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import { count } from "#lib/format.ts"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"

  const attention = $derived(
    session.apps.filter(
      (app) => app.release_status && RELEASE_STATUS[app.release_status].tone === "attention",
    ),
  )
</script>

<PageHeader title={session.publisher?.kind === "person" ? "Your apps" : `${session.publisher?.name}'s apps`}>
  {#snippet actions()}
    {#if session.can("apps")}<a href="/dashboard/apps/new" class="button button-primary"><Plus class="size-4" />Add an app</a>{/if}
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
  <ul class="mt-8 divide-y divide-hairline">
    <li class="hidden grid-cols-[minmax(0,1fr)_8rem_10rem_8rem] gap-4 px-3 pb-2 text-[13px] text-ink-muted md:grid" aria-hidden="true">
      <span>App</span><span>Version</span><span>Latest release</span><span class="text-right">Installs this week</span>
    </li>
    {#each session.apps as app, index (app.id)}
      {@const status = app.release_status ? RELEASE_STATUS[app.release_status] : null}
      <li class="enter" style:--order={index}>
        <a href="/dashboard/apps/{app.id}" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-2xl px-3 py-4 transition-colors hover:bg-well/50 md:grid-cols-[minmax(0,1fr)_8rem_10rem_8rem]">
          <span class="flex min-w-0 items-center gap-4">
            <AppIcon src={app.icon} name={app.name} class="size-11" />
            <span class="min-w-0">
              <span class="block truncate font-medium">{app.name}</span>
              <span class="block truncate font-mono text-[13px] text-ink-muted">{app.id}</span>
            </span>
          </span>
          <span class="text-[15px] tabular text-ink-soft max-md:text-right">{app.version ?? "None yet"}</span>
          <span class="flex items-center gap-2 text-[15px] text-ink-soft max-md:col-start-1 max-md:pl-15">
            {#if status}
              <span class="size-2 rounded-full {TONE_DOT[status.tone]}"></span>{status.label}
            {:else}
              <span class="size-2 rounded-full bg-ink-muted/40"></span>Waiting for the first release
            {/if}
          </span>
          <span class="text-right text-[15px] tabular text-ink-soft max-md:row-start-2 max-md:col-start-2">{count(app.installs_7d)}</span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <section class="enter mt-10 grid gap-8 rounded-tile bg-well p-7 sm:p-10 lg:grid-cols-[1fr_1fr]">
    <div>
      <h2 class="text-2xl font-semibold tracking-[-0.02em]">Put your first app on Schelf</h2>
      <p class="mt-2 leading-relaxed text-ink-soft">Connect a GitHub repository once. After that, every GitHub release you publish is built in your own workflow, checked, and sent to review.</p>
      {#if session.can("apps")}<a href="/dashboard/apps/new" class="button button-primary mt-6">Add an app</a>{/if}
    </div>
    <ol class="space-y-4 text-[15px]">
      {#each ["Claim your app id", "Connect your repository", "Commit two files", "Publish a GitHub release"] as step, index (step)}
        <li class="flex items-center gap-3">
          <span class="grid size-7 place-items-center rounded-full bg-raised text-[13px] font-semibold tabular">{index + 1}</span>
          {step}
        </li>
      {/each}
    </ol>
  </section>
{/if}
