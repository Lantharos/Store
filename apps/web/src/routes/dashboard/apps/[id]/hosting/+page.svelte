<script lang="ts">
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import Channels from "#lib/dashboard/hosting/Channels.svelte"
  import Links from "#lib/dashboard/hosting/Links.svelte"
  import UpdateFramework from "#lib/dashboard/hosting/UpdateFramework.svelte"
  import Visibility from "#lib/dashboard/hosting/Visibility.svelte"

  const settings = $derived(appSettings()())
</script>

<svelte:head><title>Links · {settings.data!.app.name} · Schelf for developers</title></svelte:head>

<div class="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
  <div class="min-w-0"><Links links={settings.data!.links} /></div>
  <div class="min-w-0 space-y-12">
    <Visibility bind:settings={() => settings.data!, (next) => settings.set(next)} />
    <UpdateFramework bind:settings={() => settings.data!, (next) => settings.set(next)} />
    <Channels bind:settings={() => settings.data!, (next) => settings.set(next)} />
  </div>
</div>
