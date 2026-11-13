<script lang="ts">
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import Domain from "#lib/dashboard/files/Domain.svelte"
  import Privacy from "#lib/dashboard/files/Privacy.svelte"
  import Address from "#lib/dashboard/project/Address.svelte"
  import DeleteProject from "#lib/dashboard/project/DeleteProject.svelte"
  import Publishers from "#lib/dashboard/project/Publishers.svelte"
  import Systems from "#lib/dashboard/project/Systems.svelte"
  import Tokens from "#lib/dashboard/project/Tokens.svelte"
  import Visibility from "#lib/dashboard/project/Visibility.svelte"

  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
</script>

<svelte:head><title>Settings · {data.app.name} · Schelf for developers</title></svelte:head>

<div class="max-w-3xl space-y-12">
  <Visibility bind:settings={() => data, (next) => settings.set(next)} />
  <Address bind:settings={() => data, (next) => settings.set(next)} />
  <Domain bind:settings={() => data, (next) => settings.set(next)} />
  <Systems settings={data} />
  <Privacy settings={data} />
  <Publishers appId={data.app.id} bind:publishers={data.trusted_publishers} />
  <Tokens appId={data.app.id} bind:tokens={data.tokens} />
  {#if session.can("apps")}<DeleteProject settings={data} />{/if}
</div>
