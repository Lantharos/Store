<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"
  import AppView from "#lib/store/page/AppView.svelte"
  import MirrorView from "#lib/store/page/MirrorView.svelte"
  import ReplacedView from "#lib/store/page/ReplacedView.svelte"

  let { data } = $props()
</script>

{#if data.view === "store"}
  {@const listing = data.app.listing.en!}
  <Meta
    title="{listing.name}: {listing.summary} · Schelf"
    description={listing.description.split("\n\n")[0]?.slice(0, 200) || listing.summary}
    path={data.path}
    image="/apps/{data.app.id}/og.png"
    imageAlt={listing.name}
    schema={data.project.indexed ? data.schema : undefined}
    indexed={data.project.indexed}
  />
  <AppView app={data.app} project={data.project} hasApp={data.hasApp} parts={data.parts} installs={data.installs} description={data.description} releases={data.releases} system={data.system} extensionAccess={data.extensionAccess} />
{:else if data.view === "replaced"}
  <Meta title="{data.app.listing.en!.name} · Schelf" description={data.replacement.note} path={data.path} indexed={false} />
  <ReplacedView app={data.app} replacement={data.replacement} />
{:else}
  <Meta title="{data.mirror.name} · Schelf" description={data.mirror.summary} path="/apps/{data.mirror.id}" indexed={false} />
  <MirrorView app={data.mirror} system={data.system} />
{/if}
