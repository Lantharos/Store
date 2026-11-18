<script lang="ts">
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import Editor from "#lib/dashboard/listing/Editor.svelte"

  const settings = $derived(appSettings()())
</script>

<svelte:head><title>Listing · {settings.data!.app.name} · Schelf for developers</title></svelte:head>

{#key settings.data!.app.id}
  <Editor settings={settings.data!} onsaved={(next) => settings.set(next)} />
{/key}
