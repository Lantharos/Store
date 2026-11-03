<script lang="ts">
  import Mail from "@lucide/svelte/icons/mail"
  import Passkeys from "#lib/dashboard/account/Passkeys.svelte"
  import PictureField from "#lib/dashboard/account/PictureField.svelte"
  import { auth } from "#lib/dashboard/api/auth.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import GitHubMark from "#lib/ui/GitHubMark.svelte"
  import Group from "#lib/ui/group/Group.svelte"
  import Row from "#lib/ui/group/Row.svelte"
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

<div class="mt-8 space-y-10">
  <Group>
    <PictureField />
  </Group>

  <Group title="Signing in" rows>
    <Row title="GitHub" description={account.github ? `Connected as ${account.github}, which proves io.github.${account.github}.` : "Connect it to prove io.github namespaces and show your GitHub picture."}>
      {#snippet leading()}<GitHubMark class="size-5" />{/snippet}
      {#if !account.github}<button type="button" class="button button-sm button-quiet" onclick={linkGitHub}>Connect</button>{/if}
    </Row>
    <Passkeys />
    <Row title="Email codes" description="Always on, sent to {account.user.email}.">
      {#snippet leading()}<Mail class="size-5" />{/snippet}
    </Row>
  </Group>

  <Group rows>
    <Row title="Sign out" description="Signs you out in this browser. The schelf command stays signed in until you run schelf logout.">
      <button type="button" class="button button-sm button-quiet" onclick={() => session.signOut().then(() => goto("/"))}>Sign out</button>
    </Row>
    <Row title="Delete your account" description="Your personal apps are delisted, and people who have them keep them. Organisations you own with others need another owner first. Your details are deleted within 30 days. This can't be undone.">
      <button type="button" class="button button-sm button-danger" onclick={() => ((typed = ""), (deleting = true))}>Delete account</button>
    </Row>
  </Group>
</div>

<Confirm bind:open={deleting} title="Delete your account?" confirm="Delete account" danger ready={typed === account.user.email} onconfirm={remove}>
  <p>Type your email to confirm.</p>
  <input bind:value={typed} class="field mt-3" placeholder={account.user.email} aria-label="Your email" autocomplete="off" />
  {#if typed && typed !== account.user.email}<p class="mt-2 text-[13px] text-ink-muted">That doesn't match yet.</p>{/if}
</Confirm>
