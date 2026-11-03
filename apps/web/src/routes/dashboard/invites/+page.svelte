<script lang="ts">
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PendingInvites from "#lib/dashboard/publishers/PendingInvites.svelte"
  import Logo from "#lib/Logo.svelte"
  import { goto } from "$app/navigation"

  const invites = $derived(session.account?.invites ?? [])
</script>

<svelte:head><title>Invitations · Schelf for developers</title></svelte:head>

{#snippet body()}
  {#if invites.length}
    <PendingInvites />
  {:else}
    <p class="text-[15px] leading-relaxed text-ink-soft">
      There are no invitations for {session.account?.user.email}{session.account?.github ? ` or ${session.account.github} on GitHub` : ""}. If someone invited another address, sign in with that one instead.
    </p>
  {/if}
{/snippet}

{#if session.publisher}
  <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">Invitations</h1>
  <div class="mt-8 max-w-2xl">{@render body()}</div>
{:else}
  <main class="grid min-h-svh place-items-center px-4 py-12">
    <div class="enter w-full max-w-[26rem]">
      <Logo class="size-10" />
      <h1 class="mt-6 mb-6 text-[26px] font-semibold tracking-[-0.02em]">Invitations</h1>
      {@render body()}
      <a href="/dashboard/welcome" class="button button-quiet mt-8 w-full">Publish as yourself instead</a>
      <button type="button" class="mt-3 w-full text-[15px] text-ink-muted hover:text-ink" onclick={() => session.signOut().then(() => goto("/"))}>Sign out</button>
    </div>
  </main>
{/if}
