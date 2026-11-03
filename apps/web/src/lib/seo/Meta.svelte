<script lang="ts">
  import { STORE_ORIGIN } from "@schelf/protocol"

  let {
    title,
    description,
    path,
    image = "/og.png",
    imageAlt = "Schelf",
    schema,
    indexed = true,
  }: {
    title: string
    description: string
    path: string
    image?: string
    imageAlt?: string
    schema?: object
    indexed?: boolean
  } = $props()

  const url = $derived(`${STORE_ORIGIN}${path}`)
  const imageUrl = $derived(image.startsWith("http") ? image : `${STORE_ORIGIN}${image}`)
  const json = $derived(schema && JSON.stringify(schema).replaceAll("<", "\\u003c"))
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {#if indexed}<link rel="canonical" href={url} />{:else}<meta name="robots" content="noindex" />{/if}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Schelf" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  {#if json}{@html `<script type="application/ld+json">${json}</script>`}{/if}
</svelte:head>
