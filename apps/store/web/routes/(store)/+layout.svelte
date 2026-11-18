<script lang="ts">
  import type { Snippet } from "svelte"
  import Footer from "#lib/store/layout/Footer.svelte"
  import Header from "#lib/store/layout/Header.svelte"

  let { children }: { children: Snippet } = $props()
</script>

<a href="#main" class="skip">Skip to content</a>
<Header />
<main id="main">
  {@render children()}
</main>
<Footer />
