<script lang="ts">
  import { type SearchHit, STORE_ORIGIN } from "@schelf/protocol"
  import AppPicker from "#lib/brand/AppPicker.svelte"
  import AssetTile from "#lib/brand/AssetTile.svelte"
  import BadgeBuilder from "#lib/brand/BadgeBuilder.svelte"
  import Swatch from "#lib/brand/Swatch.svelte"
  import Meta from "#lib/seo/Meta.svelte"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import { appHref } from "#lib/store/links.ts"

  const COLOURS = [
    { name: "Ink", hex: "#1d1b17" },
    { name: "Paper", hex: "#fcf9f3" },
    { name: "Night", hex: "#12110e" },
    { name: "Mist", hex: "#ece9e3" },
    { name: "Brass", hex: "#725b2d" },
    { name: "Sand", hex: "#ddc393" },
  ]

  const LOGO_RULES = [
    "Leave room around it, at least half its height on every side.",
    "Use the dark logo on light backgrounds and the light one on dark backgrounds. Over photos, pick whichever reads better.",
    "Keep it as it is: no other colours, outlines, shadows, stretching or turning.",
    "Write the name as Schelf, with a capital S. The store’s address is schelf.store, in lower case.",
  ]

  let app = $state<SearchHit | null>(null)
  let picking = $state(false)
  const link = $derived(app ? `${STORE_ORIGIN}${appHref(app)}` : STORE_ORIGIN)
</script>

<Meta
  title="Brand · Schelf"
  description="The Schelf logo, its colours, and badges that send people to your app on schelf.store."
  path="/brand"
/>

<div class="page">
  <h1 class="mt-6 text-[32px] font-semibold tracking-[-0.03em] sm:mt-10 sm:text-[40px]">Brand</h1>
  <p class="mt-2 max-w-2xl text-lg leading-relaxed text-ink-soft">
    The Schelf logo, its colours, and badges that send people to your app on the store. Use them freely to write about Schelf or to point people at your app.
  </p>

  <section class="mt-14" aria-labelledby="logo">
    <h2 id="logo" class="text-2xl font-semibold tracking-[-0.02em]">Logo</h2>
    <div class="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2">
      <AssetTile name="Logo with name" file="schelf-wordmark-on-light" backdrop="light" wide />
      <AssetTile name="Logo with name, light" file="schelf-wordmark-on-dark" backdrop="dark" wide />
      <AssetTile name="Logo" file="schelf-mark-on-light" backdrop="light" />
      <AssetTile name="Logo, light" file="schelf-mark-on-dark" backdrop="dark" />
    </div>
    <ul class="mt-10 grid max-w-4xl gap-x-10 gap-y-3 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
      {#each LOGO_RULES as rule (rule)}
        <li class="flex gap-3"><span aria-hidden="true" class="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"></span>{rule}</li>
      {/each}
    </ul>
  </section>

  <section class="mt-20" aria-labelledby="icon">
    <h2 id="icon" class="text-2xl font-semibold tracking-[-0.02em]">App icon</h2>
    <div class="mt-6 flex flex-wrap items-center gap-6">
      <img src="/brand/schelf-icon.svg" alt="" class="size-24 rounded-[22%]" />
      <div class="max-w-md space-y-3">
        <p class="text-[15px] leading-relaxed text-ink-soft">The icon Schelf has on Luft. Show it where Schelf sits next to other apps, like in a screenshot of a dock or a list of stores; use the logo everywhere else.</p>
        <div class="flex gap-2">
          <a href="/brand/schelf-icon.svg" download class="button button-sm button-quiet">SVG</a>
          <a href="/brand/schelf-icon.png" download class="button button-sm button-quiet">PNG</a>
        </div>
      </div>
    </div>
  </section>

  <section class="mt-20" aria-labelledby="colours">
    <h2 id="colours" class="text-2xl font-semibold tracking-[-0.02em]">Colours</h2>
    <p class="mt-2 text-[15px] text-ink-soft">Click a colour to copy it.</p>
    <div class="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each COLOURS as colour (colour.hex)}
        <Swatch {...colour} />
      {/each}
    </div>
  </section>

  <section class="mt-20 max-w-3xl" aria-labelledby="badges">
    <h2 id="badges" class="text-2xl font-semibold tracking-[-0.02em]">Get it on schelf.store</h2>
    <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">
      Put the badge on your website or README so people can find your app on Schelf. Keep it at least 40 pixels tall, keep its words as they are, and always link it to your app’s page.
    </p>
    <div class="mt-6">
      <BadgeBuilder {link}>
        {#snippet target()}
          <div class="flex flex-wrap items-center gap-3 rounded-group bg-well py-2 pr-2 pl-3">
            {#if app}
              <AppIcon src={app.icon} name={app.name} class="size-9" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-medium">{app.name}</span>
                <span class="block truncate font-mono text-[13px] text-ink-muted">{link.replace("https://", "")}</span>
              </span>
              <button type="button" class="button button-sm button-quiet" onclick={() => (app = null)}>Link to the store</button>
            {:else}
              <span class="min-w-0 flex-1 pl-1 text-[15px] text-ink-soft">Links to schelf.store. Pick your app to link to its page.</span>
            {/if}
            <button type="button" class="button button-sm button-ink" onclick={() => (picking = true)}>{app ? "Change" : "Pick an app"}</button>
          </div>
        {/snippet}
      </BadgeBuilder>
    </div>
  </section>
</div>

<AppPicker bind:open={picking} onpick={(hit) => (app = hit)} />
