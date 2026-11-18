<script lang="ts">
  import type { Snippet } from "svelte"
  import CodeBlock from "../code/CodeBlock.svelte"
  import Segmented from "../ui/fields/Segmented.svelte"
  import { BADGE_ALT, type BadgeSize, type BadgeTheme, badgeFile, badgeHtml, badgeMarkdown } from "./badge.ts"

  let { link, target }: { link: string; target?: Snippet } = $props()

  let theme = $state<BadgeTheme>("dark")
  let size = $state<BadgeSize>(56)
  const shown = $derived(theme === "auto" ? (["dark", "light"] as const) : [theme])
</script>

<div class="space-y-5">
  {@render target?.()}
  <div class="flex flex-wrap gap-3">
    <Segmented
      bind:value={theme}
      label="Badge colour"
      size="sm"
      options={[
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "auto", label: "Follow the reader" },
      ]}
    />
    <Segmented
      bind:value={size}
      label="Badge size"
      size="sm"
      options={[
        { value: 40, label: "Small" },
        { value: 56, label: "Medium" },
        { value: 72, label: "Large" },
      ]}
    />
  </div>

  <div class="grid overflow-hidden rounded-group ring-1 ring-hairline sm:grid-flow-col">
    {#each shown as variant (variant)}
      <div class="grid min-h-44 place-items-center p-8 {variant === 'dark' ? 'bg-[#fcf9f3]' : 'bg-[#12110e]'}">
        <img src={badgeFile(variant)} alt={BADGE_ALT} style:height="{size}px" class="transition-[height] duration-200" />
      </div>
    {/each}
  </div>

  <CodeBlock title="HTML" lang="html" code={badgeHtml(link, theme, size)} />
  {#if theme === "auto"}
    <p class="px-1 text-[13px] leading-relaxed text-ink-muted">This HTML works in Markdown too, GitHub READMEs included, and swaps the badge when the reader’s system is dark.</p>
  {:else}
    <CodeBlock title="Markdown" lang="text" code={badgeMarkdown(link, theme)} />
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    {#each shown as variant (variant)}
      <a href={badgeFile(variant)} download class="button button-sm button-quiet">{variant === "dark" ? "Dark" : "Light"} SVG</a>
      <a href={badgeFile(variant, "png")} download class="button button-sm button-quiet">{variant === "dark" ? "Dark" : "Light"} PNG</a>
    {/each}
  </div>
</div>
