<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import CircleAlert from "@lucide/svelte/icons/circle-alert"
  import Clock from "@lucide/svelte/icons/clock"
  import { domainCovers, type Verification } from "@schelf/protocol"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import History from "#lib/dashboard/verification/History.svelte"
  import Reply from "#lib/dashboard/verification/Reply.svelte"
  import Summary from "#lib/dashboard/verification/Summary.svelte"
  import VerificationForm from "#lib/dashboard/verification/VerificationForm.svelte"
  import { VerificationFlow } from "#lib/dashboard/verification/verification.svelte.ts"
  import { date } from "#lib/format.ts"
  import Group from "#lib/ui/group/Group.svelte"

  const publisher = $derived(session.publisher!)
  const flow = $derived(new VerificationFlow(publisher.id))
  const owner = $derived(session.can("verification"))
  const current = $derived(flow.current)
  const editable = $derived(owner && (current?.status === "draft" || current?.status === "more-requested"))
  const asked = $derived(current?.history.findLast((event) => event.kind === "more-requested")?.text ?? null)

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
</script>

<PageHeader title="Verification" text="The checkmark tells people {publisher.name} is who it says it is. It shows on its page, its apps and in the Schelf app." />

{#snippet status(icon: typeof Clock, tone: string, title: string, text: string)}
  {@const Icon = icon}
  <div class="flex items-start gap-4">
    <Icon class="mt-0.5 size-6 shrink-0 {tone}" />
    <div class="min-w-0">
      <h2 class="text-lg font-semibold">{title}</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">{text}</p>
    </div>
  </div>
{/snippet}

<div class="mt-8 space-y-10">
  {#if flow.state.error}
    <Failed error={flow.state.error} retry={() => flow.state.refresh()} />
  {:else if !flow.state.data}
    <Loading />
  {:else if !current || ((current.status === "rejected" || current.status === "revoked") && !flow.state.data.verified)}
    <Group>
      {#if current}
        {@render status(CircleAlert, "text-danger", current.status === "rejected" ? "Not verified" : "No longer verified", current.reason ?? "")}
        <p class="text-[15px] leading-relaxed text-ink-soft">You can change what you sent and ask again.</p>
      {:else}
        <div>
          <h2 class="text-lg font-semibold">What it gives</h2>
          <ul class="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft">
            <li>the checkmark beside your name, on your page, your apps and in Schelf;</li>
            <li>extensions that can run inside Luft once reviewed;</li>
            <li>download links on a domain of your own.</li>
          </ul>
        </div>
        <div>
          <h2 class="text-lg font-semibold">What you'll need</h2>
          <ul class="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft">
            <li>your legal or trading name and website;</li>
            <li>the domains you publish under, proven with a DNS record or a file, unless your namespaces already prove them;</li>
            <li>an email address on one of those domains;</li>
            <li>optionally your GitHub organisation, and documents such as a company register extract.</li>
          </ul>
        </div>
      {/if}
      {#if owner}
        <button type="button" class="button button-primary" disabled={flow.busy !== null} onclick={() => flow.start()}>{current ? "Ask again" : "Start"}</button>
      {:else}
        <p class="text-[15px] text-ink-muted">An owner of {publisher.name} can ask for verification.</p>
      {/if}
    </Group>
    {#if current}<History verification={current} />{/if}
  {:else if current.status === "draft"}
    {@const gaps = missing(current)}
    {#key current.id}<VerificationForm {flow} verification={current} {editable} />{/key}
    {#if owner}
      <Group>
        <p class="text-[15px] leading-relaxed text-ink-soft">
          {gaps.length ? `Still needed: ${gaps.join(", ")}.` : "Everything's here. Sending it shares these details with the people reviewing it, usually within three days."}
        </p>
        <button type="button" class="button button-primary" disabled={gaps.length > 0 || flow.busy !== null} onclick={() => flow.submit()}>Send for review</button>
      </Group>
    {/if}
  {:else if current.status === "more-requested"}
    <Group>
      {@render status(CircleAlert, "text-caution", "We need a little more", "Answer below. You can change the details too; your answer sends the request back for review.")}
      {#if asked}<p class="rounded-2xl bg-well px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{asked}</p>{/if}
      {#if owner}<Reply {flow} />{/if}
    </Group>
    {#key current.id}<VerificationForm {flow} verification={current} {editable} />{/key}
    <History verification={current} />
  {:else}
    <Group>
      {#if flow.state.data.verified}
        {@render status(BadgeCheck, "text-accent", `${publisher.name} is verified`, `${current.decided_at ? `Since ${date(current.decided_at)}. ` : ""}If your domains or who's behind ${publisher.name} change, tell us at legal@schelf.store.`)}
      {:else}
        {@render status(Clock, "text-accent", "Waiting for review", `Sent ${current.submitted_at ? date(current.submitted_at) : ""}. A person at Schelf is checking it, usually within three days. You'll get an email when they decide or need more.`)}
      {/if}
    </Group>
    <Summary verification={current} />
    <History verification={current} />
  {/if}
</div>
