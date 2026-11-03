<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import { domainCovers, type Verification } from "@schelf/protocol"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Thread from "#lib/dashboard/verification/Thread.svelte"
  import VerificationForm from "#lib/dashboard/verification/VerificationForm.svelte"
  import { VerificationFlow } from "#lib/dashboard/verification/verification.svelte.ts"
  import { date } from "#lib/format.ts"

  const publisher = $derived(session.publisher!)
  const flow = $derived(new VerificationFlow(publisher.id))
  const owner = $derived(session.can("verification"))
  const current = $derived(flow.current)
  const editable = $derived(owner && (current?.status === "draft" || current?.status === "more-requested"))

  function missing(verification: Verification) {
    const host = verification.contact_email?.split("@")[1] ?? ""
    return [
      !verification.legal_name && "the legal or trading name",
      !verification.website && "the website",
      !verification.domains.length && "a domain",
      !verification.contact_confirmed && "a confirmed contact email",
      verification.contact_confirmed &&
        !verification.domains.some((domain) => domainCovers(domain.name, host)) &&
        "a contact email on one of the domains",
    ].filter((item): item is string => !!item)
  }

  const STATUS = {
    draft: {
      title: "Ask for verification",
      text: "Fill this in, then send it. A person at Schelf checks it, usually within three days.",
    },
    open: {
      title: "Waiting for review",
      text: "A person at Schelf is checking what you sent. You'll get an email when they decide or need more.",
    },
    "more-requested": {
      title: "We need a little more",
      text: "Answer below. You can change the details too; your answer sends the request back for review.",
    },
    approved: { title: "Verified", text: "" },
    rejected: { title: "Not verified", text: "" },
    revoked: { title: "No longer verified", text: "" },
  } as const
</script>

<PageHeader title="Verification" text="The checkmark tells people {publisher.name} is who it says it is. It shows on its page, its apps and in the Schelf app." />

<div class="mt-10 max-w-2xl">
  {#if flow.state.error}
    <Failed error={flow.state.error} retry={() => flow.state.refresh()} />
  {:else if !flow.state.data}
    <Loading />
  {:else if flow.state.data.verified}
    <section class="enter flex items-start gap-4 rounded-2xl bg-well p-5">
      <BadgeCheck class="mt-0.5 size-6 shrink-0 text-accent" />
      <div>
        <h2 class="text-lg font-semibold">{publisher.name} is verified</h2>
        <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">
          {current?.decided_at ? `Since ${date(current.decided_at)}. ` : ""}If your domains or who's behind {publisher.name} change, tell us at <a href="mailto:legal@schelf.store" class="link">legal@schelf.store</a>.
        </p>
      </div>
    </section>
  {:else if !current || current.status === "rejected" || current.status === "revoked"}
    {#if current}
      <section class="mb-8">
        <h2 class="text-xl font-semibold">{STATUS[current.status].title}</h2>
        {#if current.reason}<p class="mt-2 rounded-2xl bg-well px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{current.reason}</p>{/if}
      </section>
    {/if}
    <section>
      <h2 class="text-xl font-semibold">{current ? "Ask again" : "What you'll need"}</h2>
      <ul class="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft">
        <li>your legal or trading name and website;</li>
        <li>the domains you publish under, proven with a DNS record or a file, unless your namespaces already prove them;</li>
        <li>an email address on one of those domains;</li>
        <li>optionally your GitHub organisation, and documents such as a company register extract.</li>
      </ul>
      {#if owner}
        <button type="button" class="button button-primary mt-6" disabled={flow.busy !== null} onclick={() => flow.start()}>Start</button>
      {:else}
        <p class="mt-6 text-[15px] text-ink-muted">An owner of {publisher.name} can ask for verification.</p>
      {/if}
    </section>
  {:else}
    {@const status = STATUS[current.status]}
    {@const gaps = missing(current)}
    <section class="mb-10">
      <h2 class="text-xl font-semibold">{status.title}</h2>
      <p class="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{status.text}</p>
    </section>

    {#if current.messages.length || current.status === "more-requested"}
      <section class="mb-12">
        <Thread {flow} verification={current} canReply={owner && current.status === "more-requested"} />
      </section>
    {/if}

    {#key current.id}<VerificationForm {flow} verification={current} {editable} />{/key}

    {#if current.status === "draft" && owner}
      <section class="mt-12 border-t border-hairline pt-8">
        {#if gaps.length}
          <p class="text-[15px] leading-relaxed text-ink-soft">Still needed: {gaps.join(", ")}.</p>
        {:else}
          <p class="text-[15px] leading-relaxed text-ink-soft">Everything's here. Sending it shares these details with the people reviewing it.</p>
        {/if}
        <button type="button" class="button button-primary mt-4" disabled={gaps.length > 0 || flow.busy !== null} onclick={() => flow.submit()}>Send for review</button>
      </section>
    {/if}
  {/if}
</div>
