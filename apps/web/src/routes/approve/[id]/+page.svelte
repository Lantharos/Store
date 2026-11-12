<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import CircleX from "@lucide/svelte/icons/circle-x"
  import type { Approval } from "@schelf/protocol"
  import { onMount } from "svelte"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import { approve, cancelApproval, loadApproval } from "#lib/dashboard/approvals/approve.ts"
  import { ago } from "#lib/format.ts"
  import Logo from "#lib/Logo.svelte"

  let { data } = $props()
  let approval = $state<Approval>()
  let error = $state<string | null>(null)
  let busy = $state(false)
  const hasPasskey = $derived((session.account?.passkeys ?? 0) > 0)
  const origin = $derived(approval ? [approval.host, approval.place].filter(Boolean).join(", ") : "")

  onMount(async () => {
    try {
      approval = await loadApproval(data.id)
    } catch (failure) {
      error = (failure as Error).message
    }
  })

  async function decide(yes: boolean) {
    busy = true
    error = null
    try {
      approval = yes ? await approve(approval!, hasPasskey) : await cancelApproval(approval!.id)
      if (yes) await session.load()
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }

  const TITLES = {
    done: "Done",
    failed: "That didn't all happen",
    cancelled: "Cancelled",
    expired: "This request expired",
  }
</script>

<svelte:head><title>Approve · Schelf</title><meta name="robots" content="noindex" /></svelte:head>

<main class="grid min-h-svh place-items-center px-4 py-12">
  <div class="enter w-full max-w-[28rem]">
    {#if !approval}
      <Logo class="mx-auto size-10" />
      {#if error}<p class="mt-6 text-center text-[15px] text-danger" role="alert">{error}</p>{/if}
    {:else}
      {#if approval.status === "done"}
        <CircleCheck class="mx-auto size-10 text-accent" />
      {:else if approval.status === "failed"}
        <CircleX class="mx-auto size-10 text-danger" />
      {:else}
        <Logo class="mx-auto size-10" />
      {/if}
      <h1 class="mt-6 text-center text-[26px] font-semibold tracking-[-0.02em]">
        {approval.status === "pending" ? "Approve this?" : TITLES[approval.status]}
      </h1>
      <p class="mt-1.5 text-center text-[15px] text-ink-soft">
        {#if approval.status === "pending"}
          The schelf command{origin ? ` on ${origin}` : ""} asked {ago(approval.created_at)}, signed in as <span class="text-ink">{session.account?.user.email}</span>.
        {:else if approval.status === "done"}
          Go back to your terminal. You can close this page.
        {:else if approval.status === "expired"}
          Nothing happened. Run the command again for a new one.
        {:else if approval.status === "cancelled"}
          Nothing happened.
        {/if}
      </p>

      <ol class="mt-7 divide-y divide-hairline overflow-hidden rounded-group bg-raised">
        {#each approval.steps as step, index (index)}
          <li class="flex gap-3 px-5 py-3.5 text-[15px] leading-relaxed">
            {#if step.outcome === "done"}<CircleCheck class="mt-0.5 size-4 shrink-0 text-accent" />
            {:else if step.outcome === "failed"}<CircleX class="mt-0.5 size-4 shrink-0 text-danger" />
            {:else}<span class="w-4 shrink-0 text-ink-muted tabular">{index + 1}</span>{/if}
            <span>
              {step.summary}
              {#if step.detail}<span class="block text-[13px] text-danger">{step.detail}</span>{/if}
            </span>
          </li>
        {/each}
      </ol>

      {#if approval.status === "pending" && approval.steps.some((step) => step.type === "publisher.create")}
        <a href="/legal/developer-agreement" target="_blank" class="mt-3 inline-block px-1 text-[13px] text-ink-muted underline-offset-2 hover:underline">The developer agreement</a>
      {/if}
      {#if error}<p class="mt-3 text-[15px] text-danger" role="alert">{error}</p>{/if}
      {#if approval.status === "pending"}
        {#if approval.passkey}
          <p class="mt-4 text-[13px] leading-relaxed text-ink-muted">
            {hasPasskey ? "This changes who can publish or removes something for good, so it needs your passkey." : "This changes who can publish or removes something for good, so it needs a passkey. You'll add one first."}
          </p>
        {/if}
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button type="button" class="button button-quiet" disabled={busy} onclick={() => decide(false)}>Cancel</button>
          <button type="button" class="button button-primary" disabled={busy} onclick={() => decide(true)}>
            {approval.passkey ? (hasPasskey ? "Approve with passkey" : "Add a passkey and approve") : "Approve"}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</main>
