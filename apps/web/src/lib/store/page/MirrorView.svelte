<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import type { MirrorEntry } from "@schelf/protocol"
  import { schelfLink } from "../../system/artifacts.ts"
  import type { System } from "../../system/detect.ts"
  import AppIcon from "../apps/AppIcon.svelte"
  import { ORIGIN_NAMES } from "../links.ts"

  let { app, system }: { app: MirrorEntry; system: System } = $props()

  const origin = $derived(ORIGIN_NAMES[app.origin])
  const linux = $derived(system.os === "linux" || system.os === "luft")
  const source = $derived(
    app.origin === "flathub"
      ? { href: `https://flathub.org/apps/${app.id}`, label: "See it on Flathub" }
      : { href: `https://packages.fedoraproject.org/pkgs/${app.package}/`, label: "See the Fedora package" },
  )
  const how = $derived(
    app.origin === "flathub"
      ? "Schelf installs it as a Flatpak and keeps it up to date with your other apps."
      : "On Luft, Schelf adds it to your system and it updates with Luft.",
  )
</script>

<article class="page">
  <header class="enter mt-6 flex flex-col gap-6 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
    <div class="flex items-center gap-5 sm:contents">
      <AppIcon src={app.icon} name={app.name} eager class="size-20 sm:size-32" />
      <div class="min-w-0 flex-1">
        <h1 class="text-[32px] leading-none font-semibold tracking-[-0.03em] sm:text-[44px]">{app.name}</h1>
        <p class="mt-2 text-ink-soft sm:mt-3 sm:text-lg">{app.summary}</p>
        <p class="mt-1.5 text-[15px] text-ink-muted">{app.publisher.name} · From {origin}</p>
      </div>
    </div>
    <div class="flex flex-col items-stretch gap-2.5 sm:items-end">
      {#if linux}
        <a href={schelfLink(app.id)} class="button button-lg button-primary">Open in Schelf</a>
      {/if}
      <a href={source.href} class="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink sm:justify-end" rel="nofollow">
        {source.label}
        <ArrowUpRight class="size-3.5" />
      </a>
    </div>
  </header>

  <section class="mt-12 max-w-[42rem] space-y-3 text-[17px] leading-relaxed text-ink-soft">
    <h2 class="text-xl font-semibold text-ink">Where it comes from</h2>
    <p>
      {app.name} is published on {origin}, not on Schelf directly. Schelf lists it so you can find it in one place.
      {how}
    </p>
    {#if !linux}
      <p>It's a Linux app. Open this page on Luft or another Linux system to install it.</p>
    {/if}
  </section>
</article>
