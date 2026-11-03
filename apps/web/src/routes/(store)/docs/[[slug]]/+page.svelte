<script lang="ts">
  import DocsShell from "#lib/docs/DocsShell.svelte"
  import Meta from "#lib/seo/Meta.svelte"

  let { data } = $props()
  const path = $derived(data.page.slug === "getting-started" ? "/docs" : `/docs/${data.page.slug}`)
</script>

<Meta title="{data.page.title} · Schelf for developers" description={data.page.description} {path} />

<DocsShell page={data.page} titles={data.titles} previous={data.previous} next={data.next} />
