<script lang="ts">
  import Download from "@lucide/svelte/icons/download"
  import { detect, linkTarget, pickFile, type ReleaseDetail, type System } from "@schelf/protocol"
  import { onMount } from "svelte"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import CopyButton from "../../code/CopyButton.svelte"

  let { code, release }: { code: string; release: ReleaseDetail | undefined } = $props()

  const OS_NAMES: Record<string, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    android: "Android",
    luft: "Linux",
  }
  let system = $state<System | null>(null)
  let showCode = $state(false)
  const label = $derived.by(() => {
    const os = system && OS_NAMES[system.os]
    const target = system && linkTarget(system)
    return os && target && release && pickFile(release.artifacts, target) ? `Download for ${os}` : "Download"
  })

  onMount(() => (system = detect(navigator.userAgent)))
</script>

<section>
  <h2 class="px-1 font-semibold">A download button for your site</h2>
  <p class="mt-0.5 px-1 text-[13px] leading-relaxed text-ink-muted">A plain link that works anywhere. A small script turns it into the right button for each visitor; style it like any other link.</p>
  <div class="mt-2.5 overflow-hidden rounded-group bg-raised">
    <div class="grid min-h-36 place-items-center bg-[color-mix(in_oklab,var(--well)_45%,var(--raised))] p-8">
      <span class="button button-ink pointer-events-none"><Download class="size-4" />{label}</span>
    </div>
    <div class="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <p class="min-w-0 flex-1 text-[13px] text-ink-muted">On your site it takes your own link styles.</p>
      <button type="button" class="text-[15px] text-ink-soft hover:text-ink" aria-expanded={showCode} onclick={() => (showCode = !showCode)}>{showCode ? "Hide the code" : "Show the code"}</button>
      <CopyButton text={code} label="Copy code" />
    </div>
    {#if showCode}<div class="px-3 pb-3"><CodeBlock lang="html" {code} /></div>{/if}
  </div>
</section>
