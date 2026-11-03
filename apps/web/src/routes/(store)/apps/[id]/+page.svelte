<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import AppView from "#lib/store/page/AppView.svelte"
  import MirrorView from "#lib/store/page/MirrorView.svelte"

  let { data } = $props()
</script>

{#if data.view === "store"}
  {@const listing = data.app.listing.en!}
  <Meta
    title="{listing.name}: {listing.summary} · Schelf"
    description={listing.description.split("\n\n")[0]?.slice(0, 200) || listing.summary}
    path={data.path}
    image="{data.path}/og.png"
    imageAlt={listing.name}
    schema={data.schema}
  />
  <AppView app={data.app} installs={data.installs} description={data.description} releases={data.releases} system={data.system} />
{:else}
  <Meta title="{data.mirror.name} · Schelf" description={data.mirror.summary} path="/apps/{data.mirror.id}" indexed={false} />
  <MirrorView app={data.mirror} system={data.system} />
{/if}
