<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import Upload from "@lucide/svelte/icons/upload"
  import type { AppSettings } from "@schelf/protocol"
  import type { Snippet } from "svelte"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { provideAppSettings } from "#lib/dashboard/apps/context.ts"
  import { projectTabs } from "#lib/dashboard/apps/tabs.ts"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import ExtensionArt from "#lib/store/apps/ExtensionArt.svelte"
  import { page } from "$app/state"

  let { children }: { children: Snippet } = $props()

  const id = $derived(page.params.id!)
  const settings = $derived(resource<AppSettings>(endpoints.app(id)))
  provideAppSettings(() => settings)

  $effect(() => {
    const owner = settings.data?.app.publisher
    if (owner) void session.use(owner)
  })

  const base = $derived(`/dashboard/apps/${id}`)
  const OVERVIEW_PAGES = ["/releases", "/upload"]
  const tabs = $derived(
    settings.data
      ? projectTabs(settings.data.app.kind).map((tab) => {
          const href = `${base}${tab.path}`
          const rest = page.url.pathname.slice(base.length)
          const active = tab.path
            ? page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
            : rest === "" || OVERVIEW_PAGES.some((path) => rest.startsWith(path))
          return { href, label: tab.label, active }
        })
      : [],
  )
  const app = $derived(settings.data?.app)
  const storePath = $derived(settings.data ? new URL(settings.data.links.page).pathname : "")
</script>

{#if settings.error && !app}
  <Failed error={settings.error} retry={() => settings.refresh()} />
{:else if !app}
  <div class="flex items-center gap-5"><div class="placeholder size-16 rounded-[22%]"></div><div class="placeholder h-8 w-48"></div></div>
  <div class="mt-10"><Loading /></div>
{:else}
  <header class="flex flex-col gap-5 sm:flex-row sm:items-center">
    <div class="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
      {#if app.kind === "extension"}
        <ExtensionArt art={app.art} icon={app.icon} name={app.name} width={128} class="h-14 sm:h-16" />
      {:else}
        <AppIcon src={app.icon} name={app.name} class="size-14 sm:size-16" />
      {/if}
      <div class="min-w-0">
        <h1 class="truncate text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[30px]">{app.name}</h1>
        <p class="truncate font-mono text-[13px] text-ink-muted">
          {app.publisher_slug}/{app.slug}{#if app.visibility === "unlisted"}<span>{" · "}unlisted</span>{/if}{#if app.repository}<span class="max-sm:hidden">{" · "}github.com/{app.repository}</span>{/if}
        </p>
      </div>
    </div>
    <div class="flex gap-2 self-start sm:self-auto">
      {#if session.can("releases") && app.kind !== "extension"}
        <a href="/dashboard/apps/{app.id}/upload" class="button button-quiet"><Upload class="size-4" />Upload</a>
      {/if}
      {#if app.status === "published"}
        <a href={storePath} target="_blank" class="button button-quiet">View page<ArrowUpRight class="size-4" /></a>
      {/if}
    </div>
  </header>

  <nav aria-label="{app.name} sections" class="-mx-4 mt-7 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
    <ul class="flex w-max gap-1 text-[15px]">
      {#each tabs as tab (tab.href)}
        <li>
          <a href={tab.href} aria-current={tab.active ? "page" : undefined} class="block rounded-full px-4 py-1.5 transition-colors {tab.active ? 'bg-well text-ink' : 'text-ink-soft hover:text-ink'}">
            {tab.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="mt-6">{@render children()}</div>
{/if}
