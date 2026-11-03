<script lang="ts">
  import Mail from "@lucide/svelte/icons/mail"
  import Passkeys from "#lib/dashboard/account/Passkeys.svelte"
  import { auth } from "#lib/dashboard/api/auth.ts"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Confirm from "#lib/ui/overlay/Confirm.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"
  import { goto } from "$app/navigation"

  const account = $derived(session.account!)
  const developer = $derived(account.developer!)
  const outdated = $derived(account.agreement.accepted !== account.agreement.current)
  let deleting = $state(false)
  let typed = $state("")

  async function acceptAgreement() {
    try {
      await api.post(endpoints.account, {
        name: developer.name,
        kind: developer.kind,
        agreement: account.agreement.current,
      })
      await session.load()
      toasts.show("Thanks. You're on the current agreement.")
    } catch (error) {
      toasts.error(error)
    }
  }

  async function linkGitHub() {
    await auth.linkSocial({ provider: "github", callbackURL: `${location.origin}/dashboard/account` })
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
  <h2 class="text-xl font-semibold">You</h2>
  <dl class="mt-4 grid max-w-xl grid-cols-[8rem_1fr] gap-y-3 text-[15px]">
    <dt class="text-ink-muted">Shown as</dt>
    <dd><a href="/developers/{developer.slug}" class="hover:underline">{developer.name}</a></dd>
    <dt class="text-ink-muted">Publishing as</dt>
    <dd>{developer.kind === "person" ? "A person" : "An organisation"}</dd>
    <dt class="text-ink-muted">Email</dt>
    <dd class="truncate">{account.user.email}</dd>
  </dl>
</section>

<section class="mt-12 max-w-2xl">
  <h2 class="text-xl font-semibold">Signing in</h2>
  <div class="mt-2 divide-y divide-hairline">
    <div class="flex items-center gap-4 py-4">
      <svg viewBox="0 0 16 16" class="size-5 shrink-0 text-ink-muted" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
      <div class="min-w-0 flex-1">
        <p class="font-medium">GitHub</p>
        <p class="text-[15px] text-ink-muted">{account.github ? `Connected as ${account.github}. It proves io.github.${account.github}.` : "Connect it to prove io.github namespaces instantly."}</p>
      </div>
      {#if !account.github}<button type="button" class="button button-sm button-quiet" onclick={linkGitHub}>Connect</button>{/if}
    </div>
    <Passkeys />
    <div class="flex items-center gap-4 py-4">
      <Mail class="size-5 shrink-0 text-ink-muted" />
      <div class="min-w-0 flex-1">
        <p class="font-medium">Email codes</p>
        <p class="text-[15px] text-ink-muted">Always on, sent to {account.user.email}.</p>
      </div>
    </div>
  </div>
</section>

<section class="mt-12 max-w-2xl">
  <h2 class="text-xl font-semibold">Developer agreement</h2>
  {#if outdated}
    <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">The agreement changed since you accepted it. New releases wait until you've read <a href="/legal/developer-agreement" target="_blank" class="link">version {account.agreement.current}</a> and accepted it.</p>
    <button type="button" class="button button-sm button-primary mt-4" onclick={acceptAgreement}>Accept version {account.agreement.current}</button>
  {:else}
    <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">You accepted <a href="/legal/developer-agreement" class="link">version {account.agreement.current}</a>, the current one.</p>
  {/if}
</section>

<section class="mt-12 max-w-2xl">
  <h2 class="text-xl font-semibold">Delete your account</h2>
  <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">Your apps are delisted, and people who have them keep them. Your details are deleted within 30 days. This can't be undone.</p>
  <button type="button" class="button button-sm button-danger mt-4" onclick={() => ((typed = ""), (deleting = true))}>Delete account</button>
</section>

<Confirm bind:open={deleting} title="Delete your account?" confirm="Delete account" danger ready={typed === account.user.email} onconfirm={remove}>
  <p>Type your email to confirm.</p>
  <input bind:value={typed} class="field mt-3" placeholder={account.user.email} aria-label="Your email" autocomplete="off" />
  {#if typed && typed !== account.user.email}<p class="mt-2 text-[13px] text-ink-muted">That doesn't match yet.</p>{/if}
</Confirm>
