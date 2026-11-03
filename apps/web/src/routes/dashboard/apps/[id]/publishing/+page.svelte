<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import SetupFiles from "#lib/dashboard/apps/SetupFiles.svelte"
  import Publishers from "#lib/dashboard/publishing/Publishers.svelte"
  import Tokens from "#lib/dashboard/publishing/Tokens.svelte"

  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
  const published = $derived(data.app.version !== null)
  let setupOpen = $state(false)
</script>

<svelte:head><title>Publishing · {data.app.name} · Schelf for developers</title></svelte:head>

<div class="max-w-3xl space-y-12">
  {#if !published}
    <section>
      <button type="button" class="flex items-center gap-1.5 px-1 font-semibold hover:text-ink-soft" aria-expanded={setupOpen} onclick={() => (setupOpen = !setupOpen)}>
        Set up publishing
        <ChevronDown class="size-4 transition-transform {setupOpen ? 'rotate-180' : ''}" />
      </button>
      <p class="mt-0.5 px-1 text-[13px] leading-relaxed text-ink-muted">
        Commit these files, or run <span class="font-mono text-[13px]">bunx schelf init</span> in your repository to write them.
      </p>
      {#if setupOpen}<div class="mt-4"><SetupFiles setup={data.setup} /></div>{/if}
    </section>
  {/if}
  <Publishers appId={data.app.id} bind:publishers={data.trusted_publishers} />
  <Tokens appId={data.app.id} bind:tokens={data.tokens} />
</div>
