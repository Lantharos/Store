<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open"
  import Plus from "@lucide/svelte/icons/plus"
  import Search from "@lucide/svelte/icons/search"
  import ShieldCheck from "@lucide/svelte/icons/shield-check"
  import { page } from "$app/state"
  import Logo from "../../Logo.svelte"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import Kbd from "../../ui/Kbd.svelte"
  import { session } from "../api/session.svelte.ts"
  import { RELEASE_STATUS, TONE_DOT } from "../releases/status.ts"
  import UserRow from "./UserRow.svelte"

  let { onsearch }: { onsearch: () => void } = $props()
  const path = $derived(page.url.pathname)
  const appPath = (id: string) => `/dashboard/apps/${id}`
</script>

<div class="flex h-full flex-col gap-1 overflow-y-auto p-4 text-[15px]">
  <a href="/dashboard" class="mb-4 flex items-center gap-2.5 px-2 pt-1 text-lg font-semibold"><Logo class="size-7" />Schelf</a>

  <button type="button" onclick={onsearch} class="mb-4 flex h-9 items-center gap-2.5 rounded-xl bg-well px-3 text-ink-muted transition-colors hover:text-ink">
    <Search class="size-4" />
    <span class="flex-1 text-left">Go to</span>
    <Kbd keys="mod+K" />
  </button>

  <a href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined} class="rounded-xl px-2 py-1.5 text-[13px] text-ink-muted hover:text-ink aria-[current=page]:text-ink">Apps</a>
  <nav aria-label="Apps" class="space-y-0.5">
    {#each session.apps as app (app.id)}
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
    <a
      href="/dashboard/apps/new"
      aria-current={path === "/dashboard/apps/new" ? "page" : undefined}
      class="flex items-center gap-3 rounded-xl px-2 py-1.5 text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink"
    >
      <span class="grid size-7 place-items-center rounded-[22%] bg-well"><Plus class="size-4" /></span>
      Add an app
    </a>
  </nav>

  <div class="mt-auto space-y-0.5 pt-6 text-ink-soft">
    <a href="/dashboard/namespaces" aria-current={path.startsWith("/dashboard/namespaces") ? "page" : undefined} class="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink">
      <ShieldCheck class="size-4" />Namespaces
    </a>
    <a href="/docs" class="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:text-ink"><BookOpen class="size-4" />Docs</a>
    <UserRow />
  </div>
</div>
