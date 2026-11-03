<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import type { AppSettings } from "@schelf/protocol"
  import type { Snippet } from "svelte"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { provideAppSettings } from "#lib/dashboard/apps/context.ts"
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
  const tabs = $derived([
    {
      href: base,
      label: "Releases",
      active: page.url.pathname === base || page.url.pathname.startsWith(`${base}/releases`),
    },
    { href: `${base}/listing`, label: "Listing", active: page.url.pathname === `${base}/listing` },
    { href: `${base}/publishing`, label: "Publishing", active: page.url.pathname === `${base}/publishing` },
    { href: `${base}/stats`, label: "Stats", active: page.url.pathname === `${base}/stats` },
  ])
  const app = $derived(settings.data?.app)
  const storePath = $derived(app ? `/${app.kind === "extension" ? "extensions" : "apps"}/${app.id}` : "")
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
          {app.id}{#if app.repository}<span class="max-sm:hidden">{" · "}github.com/{app.repository}</span>{/if}
        </p>
      </div>
    </div>
    {#if app.status === "listed" || app.status === "delisted"}
      <a href={storePath} target="_blank" class="button button-quiet self-start sm:self-auto">View page<ArrowUpRight class="size-4" /></a>
    {/if}
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
