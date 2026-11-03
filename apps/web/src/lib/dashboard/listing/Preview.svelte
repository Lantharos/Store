<script lang="ts">
  import Download from "@lucide/svelte/icons/download"
  import type { DashboardScreenshot, ListingMeta, ListingText } from "@schelf/protocol"
  import { untrack } from "svelte"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import { tileStyle } from "../../store/apps/tile.ts"
  import { categoryLabel } from "../../store/categories.ts"
  import Segmented from "../../ui/fields/Segmented.svelte"

  let {
    text,
    meta,
    screenshots,
    developer,
    extension,
  }: {
    text: ListingText
    meta: ListingMeta
    screenshots: DashboardScreenshot[]
    developer: string
    extension: boolean
  } = $props()

  type System = "windows" | "macos" | "linux" | "luft"
  let system = $state<System>(untrack(() => (extension ? "luft" : "windows")))
  let scheme = $state<"light" | "dark">("light")

  const BUTTONS: Record<System, string> = {
    windows: "Download for Windows",
    macos: "Download for Mac",
    linux: "Download for Linux",
    luft: "Open in Schelf",
  }
  const paragraphs = $derived(
    text.description
      .split(/\n{2,}/)
      .filter(Boolean)
      .slice(0, 2),
  )
  const shot = $derived(
    screenshots.find((item) => !item.platform || item.platform.startsWith(system)) ?? screenshots[0],
  )
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    {#if !extension}
      <Segmented
        bind:value={system}
        label="Preview on"
        size="sm"
        options={[
          { value: "windows", label: "Windows" },
          { value: "macos", label: "Mac" },
          { value: "linux", label: "Linux" },
          { value: "luft", label: "Luft" },
        ]}
      />
    {/if}
    <Segmented bind:value={scheme} label="Appearance" size="sm" options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
  </div>

  <div data-scheme={scheme} class="overflow-hidden rounded-2xl bg-canvas text-ink shadow-float ring-1 ring-hairline">
    <div class="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
      <span class="size-2.5 rounded-full bg-well"></span><span class="size-2.5 rounded-full bg-well"></span><span class="size-2.5 rounded-full bg-well"></span>
      <span class="ml-2 truncate font-mono text-[11px] text-ink-muted">schelf.store</span>
    </div>
    <div class="space-y-5 p-5">
      <div class="flex items-center gap-4">
        <AppIcon src={meta.icon} name={text.name || "?"} class="size-14 text-xl" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xl leading-tight font-semibold tracking-[-0.02em]">{text.name || "Your app's name"}</p>
          <p class="truncate text-[13px] text-ink-soft">{text.summary || "A short line about what it does"}</p>
          <p class="truncate text-[12px] text-ink-muted">{developer}{meta.categories[0] ? ` · ${categoryLabel(meta.categories[0])}` : ""}</p>
        </div>
      </div>
      <span class="button button-sm button-primary pointer-events-none w-full">
        {#if system !== "luft"}<Download class="size-3.5" />{/if}{BUTTONS[system]}
      </span>
      {#if shot}
        <img src={shot.url} alt="" class="shot aspect-[16/10] w-full object-cover" />
      {:else}
        <div class="grid aspect-[16/10] place-items-center rounded-[14px] bg-well text-[13px] text-ink-muted">Screenshots show here</div>
      {/if}
      <div class="space-y-2 text-[13px] leading-relaxed text-ink-soft">
        {#each paragraphs as paragraph}<p class="line-clamp-3">{paragraph}</p>{:else}<p class="text-ink-muted">Your description shows here.</p>{/each}
      </div>
    </div>
  </div>

  <p class="pt-2 text-[13px] text-ink-muted">When it's featured</p>
  <div data-scheme={scheme} class="rounded-2xl bg-canvas p-3 ring-1 ring-hairline">
    <div style={tileStyle(meta.brand_color)} class="flex items-center gap-3 rounded-[16px] bg-(--tile) p-4 text-(--tile-ink)">
      <AppIcon src={meta.icon} name={text.name || "?"} class="size-10" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold">{text.name || "Your app"}</p>
        <p class="truncate text-[13px] text-(--tile-soft)">{text.summary || "A short line about what it does"}</p>
      </div>
      <span class="button button-sm bg-(--tile-button) text-(--tile-button-ink)">Get</span>
    </div>
  </div>
</div>
