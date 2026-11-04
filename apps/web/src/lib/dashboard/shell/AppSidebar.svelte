<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open"
  import Plus from "@lucide/svelte/icons/plus"
  import Search from "@lucide/svelte/icons/search"
  import { page } from "$app/state"
  import Logo from "../../Logo.svelte"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import Kbd from "../../ui/Kbd.svelte"
  import { session } from "../api/session.svelte.ts"
  import { projectGroups } from "../project/groups.ts"
  import PublisherSwitcher from "../publishers/PublisherSwitcher.svelte"
  import { RELEASE_STATUS, TONE_DOT } from "../releases/status.ts"
  import NavLink from "./NavLink.svelte"
  import UserRow from "./UserRow.svelte"

  let { onsearch }: { onsearch: () => void } = $props()
  const path = $derived(page.url.pathname)
  const appPath = (id: string) => `/dashboard/apps/${id}`
</script>

<div class="flex h-full flex-col gap-1 p-4 text-[15px]">
  <a href="/dashboard" class="mb-5 flex items-center gap-2.5 px-2 pt-1 text-lg font-semibold"><Logo class="size-7" />Schelf</a>

  <PublisherSwitcher />

  <button type="button" onclick={onsearch} class="mb-4 flex h-9 items-center gap-2.5 rounded-xl bg-well px-3 text-ink-muted transition-colors hover:text-ink">
    <Search class="size-4" />
    <span class="flex-1 text-left">Go to</span>
    <Kbd keys="mod+K" />
  </button>

  <a href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined} class="rounded-xl px-2 py-1.5 text-[13px] text-ink-muted hover:text-ink aria-[current=page]:text-ink">Projects</a>
  <nav aria-label="Projects" class="-mx-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-4">
    {#each projectGroups(session.apps) as group (group.kind)}
      <p class="px-2 pt-3 pb-1 text-[13px] text-ink-muted first:pt-0">{group.label}</p>
      {#each group.apps as app (app.id)}
        {@const status = app.release_status ? RELEASE_STATUS[app.release_status] : null}
        <a
          href={appPath(app.id)}
          aria-current={path.startsWith(appPath(app.id)) ? "page" : undefined}
          class="flex items-center gap-3 rounded-xl px-2 py-1.5 text-ink-soft transition-colors hover:bg-well/60 aria-[current=page]:bg-well aria-[current=page]:text-ink"
        >
          <AppIcon src={app.icon} name={app.name} class="size-7 text-[13px]" />
          <span class="min-w-0 flex-1 truncate">{app.name}</span>
          {#if status && status.tone !== "done" && status.tone !== "quiet"}
            <span class="size-2 shrink-0 rounded-full {TONE_DOT[status.tone]}" title={status.label}></span>
          {/if}
        </a>
      {/each}
    {/each}
    {#if session.can("apps")}
    <a
      href="/dashboard/projects/new"
      aria-current={path === "/dashboard/projects/new" ? "page" : undefined}
      class="flex items-center gap-3 rounded-xl px-2 py-1.5 text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink"
    >
      <span class="grid size-7 place-items-center rounded-[22%] bg-well"><Plus class="size-4" /></span>
      New project
    </a>
    {/if}
  </nav>

  <div class="space-y-0.5 pt-4">
    <NavLink href="/docs" icon={BookOpen}>Docs</NavLink>
    <UserRow />
  </div>
</div>
