<script lang="ts">
  import Mail from "@lucide/svelte/icons/mail"
  import MethodRow from "#lib/dashboard/account/MethodRow.svelte"
  import Passkeys from "#lib/dashboard/account/Passkeys.svelte"
  import PictureField from "#lib/dashboard/account/PictureField.svelte"
  import { auth } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import GitHubMark from "#lib/ui/GitHubMark.svelte"
  import Confirm from "#lib/ui/overlay/Confirm.svelte"
  import { goto } from "$app/navigation"

  const account = $derived(session.account!)
  let deleting = $state(false)
  let typed = $state("")

  async function linkGitHub() {
    await auth.linkSocial({
      provider: "github",
      callbackURL: `${location.origin}/dashboard/settings/account`,
    })
  }

  async function remove() {
    const { error } = await auth.deleteUser({ callbackURL: "/" })
    if (error) throw new Error(error.message ?? "Your account wasn't deleted")
    await session.signOut()
    await goto("/")
  }
</script>

<PageHeader title="Account" />

<section class="mt-8">
  <PictureField />
</section>

<section class="mt-12">
  <h2 class="text-xl font-semibold">Signing in</h2>
  <div class="mt-2 divide-y divide-hairline">
    <MethodRow title="GitHub" text={account.github ? `Connected as ${account.github}, which proves io.github.${account.github}.` : "Connect it to prove io.github namespaces and show your GitHub picture."}>
      {#snippet icon()}<GitHubMark class="size-5" />{/snippet}
      {#snippet action()}
        {#if !account.github}<button type="button" class="button button-sm button-quiet" onclick={linkGitHub}>Connect</button>{/if}
      {/snippet}
    </MethodRow>
    <Passkeys />
    <MethodRow title="Email codes" text="Always on, sent to {account.user.email}.">
      {#snippet icon()}<Mail class="size-5" />{/snippet}
    </MethodRow>
  </div>
</section>

<section class="mt-12">
  <h2 class="text-xl font-semibold">Sign out</h2>
  <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">Signs you out in this browser. The schelf command stays signed in until you run schelf logout.</p>
  <button type="button" class="button button-sm button-quiet mt-4" onclick={() => session.signOut().then(() => goto("/"))}>Sign out</button>
</section>

<section class="mt-12">
  <h2 class="text-xl font-semibold">Delete your account</h2>
  <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">Your personal apps are delisted, and people who have them keep them. Organisations you own with others need another owner first. Your details are deleted within 30 days. This can't be undone.</p>
  <button type="button" class="button button-sm button-danger mt-4" onclick={() => ((typed = ""), (deleting = true))}>Delete account</button>
</section>

<Confirm bind:open={deleting} title="Delete your account?" confirm="Delete account" danger ready={typed === account.user.email} onconfirm={remove}>
  <p>Type your email to confirm.</p>
  <input bind:value={typed} class="field mt-3" placeholder={account.user.email} aria-label="Your email" autocomplete="off" />
  {#if typed && typed !== account.user.email}<p class="mt-2 text-[13px] text-ink-muted">That doesn't match yet.</p>{/if}
</Confirm>
