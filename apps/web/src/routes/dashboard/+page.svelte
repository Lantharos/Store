<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right"
  import Plus from "@lucide/svelte/icons/plus"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { projectGroups } from "#lib/dashboard/project/groups.ts"
  import ProjectList from "#lib/dashboard/project/ProjectList.svelte"
  import Restorable from "#lib/dashboard/project/Restorable.svelte"
  import PendingInvites from "#lib/dashboard/publishers/PendingInvites.svelte"
  import { RELEASE_STATUS } from "#lib/dashboard/releases/status.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"

  const attention = $derived(
    session.apps.filter(
      (app) => app.release_status && RELEASE_STATUS[app.release_status].tone === "attention",
    ),
  )
</script>

<PageHeader title={session.publisher?.kind === "person" ? "Your projects" : `${session.publisher?.name}'s projects`}>
  {#snippet actions()}
    {#if session.can("apps")}
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
  {#each projectGroups(session.apps) as group (group.kind)}
    <section class="mt-8">
      <h2 class="mb-2.5 px-1 font-semibold">{group.label}</h2>
      <ProjectList apps={group.apps} />
    </section>
  {/each}
{:else}
  <section class="enter mt-8 rounded-group bg-raised p-7 sm:p-9">
    <h2 class="text-2xl font-semibold tracking-[-0.02em]">Put your first project on Schelf</h2>
    <p class="mt-2 max-w-xl leading-relaxed text-ink-soft">An app for Luft and the store, or any app you want download links and updates for, open or closed source. Send releases from GitHub Actions or upload them yourself.</p>
    {#if session.can("apps")}<a href="/dashboard/projects/new" class="button button-primary mt-6">New project</a>{/if}
  </section>
{/if}

{#if session.publisher && session.can("apps")}<Restorable publisherId={session.publisher.id} />{/if}
