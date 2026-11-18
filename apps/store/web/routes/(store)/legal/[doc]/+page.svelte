<script lang="ts">
  import Meta from "#lib/seo/Meta.svelte"

  let { data } = $props()
</script>

<Meta title="{data.page.title} · Schelf" description={data.page.description} path="/legal/{data.page.slug}" />

<article class="page max-w-3xl! pt-6 sm:pt-10">
  <h1 class="text-[34px] leading-tight font-semibold tracking-[-0.03em] sm:text-[42px]">{data.page.title}</h1>
  <p class="mt-3 text-lg leading-relaxed text-ink-soft">{data.page.description}</p>
  <div class="prose mt-8">{@html data.page.html}</div>
</article>
