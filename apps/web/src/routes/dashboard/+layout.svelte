<script lang="ts">
  import type { Snippet } from "svelte"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Shell from "#lib/dashboard/shell/Shell.svelte"
  import { page } from "$app/state"

  let { children }: { children: Snippet } = $props()
  const bare = $derived(!session.signedIn || !session.publisher)
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if bare}
  {@render children()}
{:else}
  <Shell>{@render children()}</Shell>
{/if}
