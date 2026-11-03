<script lang="ts">
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import SetupFiles from "#lib/dashboard/apps/SetupFiles.svelte"
  import Publishers from "#lib/dashboard/publishing/Publishers.svelte"
  import Tokens from "#lib/dashboard/publishing/Tokens.svelte"

  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
</script>

<svelte:head><title>Publishing · {data.app.name} · Schelf for developers</title></svelte:head>

<div class="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
  <div class="min-w-0 space-y-12">
    <Publishers appId={data.app.id} bind:publishers={data.trusted_publishers} />
    <Tokens appId={data.app.id} bind:tokens={data.tokens} />
  </div>
  <section class="min-w-0">
    <h2 class="text-xl font-semibold">The files in your repository</h2>
    <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">What <span class="font-mono text-[13px]">bunx schelf init</span> writes, if you'd rather copy them yourself.</p>
    <div class="mt-5"><SetupFiles setup={data.setup} /></div>
  </section>
</div>
