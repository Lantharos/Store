<script lang="ts">
  import type { CatalogEntry, SearchHit } from "@schelf/protocol"
  import { categoryLabel } from "../categories.ts"
  import { appHref, originOf } from "../links.ts"
  import AppIcon from "./AppIcon.svelte"

  let {
    app,
    detail,
    soon: showSoon = true,
  }: { app: CatalogEntry | SearchHit; detail?: string; soon?: boolean } = $props()

  const origin = $derived("origin" in app ? originOf(app) : null)
  const soon = $derived("platforms" in app && Object.keys(app.platforms).length === 0)
  const meta = $derived(
    detail ??
      (origin ? `From ${origin}` : app.categories[0] ? categoryLabel(app.categories[0]) : app.publisher.name),
  )
</script>

<a href={appHref(app)} class="group flex items-center gap-4 rounded-2xl py-3.5 outline-offset-2">
  <AppIcon src={app.icon} name={app.name} class="size-14 transition-transform duration-(--spring-snappy-duration) ease-(--spring-snappy) group-hover:scale-[1.04] group-active:scale-[0.97]" />
  <div class="min-w-0 flex-1">
    <p class="truncate font-semibold">{app.name}</p>
    <p class="truncate text-[15px] text-ink-soft">{app.summary}</p>
    <p class="truncate text-[13px] text-ink-muted">{meta}</p>
  </div>
  {#if soon}
    {#if showSoon}<span class="shrink-0 text-[13px] text-ink-muted">Coming soon</span>{/if}
  {:else}
    <span class="button button-sm button-quiet shrink-0 group-hover:bg-[color-mix(in_oklab,var(--ink)_12%,transparent)]">
      {origin ? "Open" : "Get"}
    </span>
  {/if}
</a>
