<script lang="ts">
  import Footer from "#lib/store/layout/Footer.svelte"
  import Header from "#lib/store/layout/Header.svelte"
  import { page } from "$app/state"

  const COPY: Record<number, { title: string; text: string }> = {
    404: { title: "Nothing here", text: "This page doesn't exist, or it moved." },
    410: {
      title: "This app is gone",
      text: "It was removed from Schelf. If you have it installed, Schelf will tell you what to do.",
    },
  }

  const copy = $derived(
    COPY[page.status] ?? {
      title: "Something went wrong",
      text: page.error?.message ?? "Try again in a moment.",
    },
  )
  const message = $derived(
    page.status in COPY && page.error?.message !== "Not Found" ? page.error?.message : copy.text,
  )
</script>

<svelte:head>
  <title>{copy.title} · Schelf</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<Header />
<main id="main" class="page">
  <section class="enter mt-16 max-w-xl sm:mt-24">
    <p class="font-mono text-[15px] text-ink-muted">{page.status}</p>
    <h1 class="mt-2 text-[36px] font-semibold tracking-[-0.03em] sm:text-[44px]">{copy.title}</h1>
    <p class="mt-3 text-lg leading-relaxed text-ink-soft">{message}</p>
    <div class="mt-8 flex flex-wrap gap-2">
      {#if page.status >= 500}
        <button type="button" class="button button-ink" onclick={() => location.reload()}>Reload</button>
        <a href="/" class="button button-quiet">Discover apps</a>
      {:else}
        <a href="/" class="button button-ink">Discover apps</a>
      {/if}
      {#if page.status < 500}<a href="/search" class="button button-quiet">Search</a>{/if}
    </div>
  </section>
</main>
<Footer />
