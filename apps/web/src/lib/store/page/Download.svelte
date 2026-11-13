<script lang="ts">
  import Download from "@lucide/svelte/icons/download"
  import type { Artifact, System } from "@schelf/protocol"
  import { onMount } from "svelte"
  import { bytes } from "../../format.ts"
  import { downloadHref, KIND_NAMES, pickArtifact, schelfLink, systemName } from "../../system/artifacts.ts"
  import { refine } from "../../system/refine.ts"

  let {
    id,
    extension = false,
    artifacts,
    system: detected,
    others = $bindable(false),
    panel,
    inSchelf = true,
    downloads,
    version,
  }: {
    id: string
    extension?: boolean
    inSchelf?: boolean
    artifacts: Artifact[]
    system: System
    others?: boolean
    panel: string
    downloads: string | null
    version: string
  } = $props()

  let refined = $state<System | null>(null)
  const system = $derived(refined ?? detected)

  onMount(async () => {
    refined = await refine(detected)
  })

  const onLuft = $derived(inSchelf && system.os === "luft")
  const chosen = $derived(extension || onLuft ? null : pickArtifact(artifacts, system))
  const name = $derived(systemName(system))
</script>

<div class="flex flex-col items-stretch gap-2.5 sm:items-end">
  {#if onLuft}
    <a href={schelfLink(id)} class="button button-lg button-primary">Open in Schelf</a>
    <p class="text-[13px] text-ink-muted sm:text-right">
      Installs and updates through Schelf ·
      {#if !extension}<button type="button" class="text-accent hover:underline" aria-expanded={others} aria-controls={panel} onclick={() => (others = !others)}>Other systems</button>{/if}
    </p>
  {:else if extension}
    <a href={schelfLink(id)} class="button button-lg button-primary">Open in Schelf</a>
    <p class="max-w-64 text-[13px] leading-relaxed text-ink-muted sm:text-right">Extensions are for Luft. Open this page on Luft to add it.</p>
  {:else if chosen}
    <a href={downloadHref(chosen, downloads, version)} download class="button button-lg button-primary">
      <Download class="size-[18px]" strokeWidth={2.2} />
      Download for {name}
    </a>
    <p class="text-[13px] text-ink-muted sm:text-right">
      {KIND_NAMES[chosen.kind]} · {bytes(chosen.size)} ·
      <button type="button" class="text-accent hover:underline" aria-expanded={others} aria-controls={panel} onclick={() => (others = !others)}>Other systems</button>
    </p>
    {#if inSchelf && system.os === "linux"}
      <a href={schelfLink(id)} class="text-[13px] text-ink-muted hover:text-ink sm:text-right">On Luft? Open in Schelf</a>
    {/if}
  {:else}
    <p class="text-[15px] text-ink-soft sm:text-right">
      {name ? `Not available for ${name} yet.` : "Pick the system you'll use it on."}
    </p>
  {/if}
</div>
