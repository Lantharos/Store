<script lang="ts">
  import type { AppIndex, Replacement } from "@schelf/protocol"
  import AppIcon from "../apps/AppIcon.svelte"

  let { app, replacement }: { app: AppIndex; replacement: Replacement } = $props()

  const name = $derived(app.listing.en!.name)
</script>

<article class="page">
  <section class="enter mt-16 max-w-xl sm:mt-24">
    <AppIcon src={app.icon} {name} eager class="size-16" />
    <h1 class="mt-6 text-[36px] font-semibold tracking-[-0.03em] sm:text-[44px]">{name} was replaced</h1>
    <p class="mt-3 text-lg leading-relaxed text-ink-soft">
      {replacement.note} It continues as <a href={replacement.page} class="link">{replacement.name}</a>.
    </p>
  </section>
</article>
