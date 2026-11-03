<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import { AUTOMATIC_REVIEWER, type CheckResult, type ReleaseDetail } from "@schelf/protocol"
  import type { Snippet } from "svelte"
  import { ago, list, plural } from "../../format.ts"
  import { PLATFORM_NAMES } from "../../system/artifacts.ts"
  import CheckRow from "./CheckRow.svelte"
  import Rollout from "./Rollout.svelte"
  import Step, { type StepState } from "./Step.svelte"

  let {
    appId,
    release,
    previous,
    onchange,
    header,
  }: {
    appId: string
    release: ReleaseDetail
    previous: string | null
    onchange: (release: ReleaseDetail) => void
    header?: Snippet
  } = $props()

  const failed = $derived(release.checks.filter((check) => check.status === "failed"))
  const warnings = $derived(release.checks.filter((check) => check.status === "warning"))
  const checking = $derived(release.status === "uploading" || release.status === "checking")
  let showChecks = $state<boolean | null>(null)
  const checksOpen = $derived(showChecks ?? (failed.length > 0 || warnings.length > 0))

  const review = $derived(release.timeline.findLast((step) => step.kind === "review"))
  const shipped = $derived(["rolling-out", "live", "withdrawn", "pulled"].includes(release.status))
  const systems = $derived(list([...new Set(release.platforms.map((platform) => PLATFORM_NAMES[platform]))]))

  const order = (check: CheckResult) => ({ failed: 0, warning: 1, passed: 2 })[check.status]
  const sortedChecks = $derived([...release.checks].sort((a, b) => order(a) - order(b)))

  const checkState: StepState = $derived(failed.length ? "failed" : checking ? "current" : "done")
  const reviewState: StepState = $derived(
    release.status === "changes-requested" || release.status === "rejected"
      ? "failed"
      : release.status === "in-review"
        ? "current"
        : shipped
          ? "done"
          : "pending",
  )
  const rolloutState: StepState = $derived(
    release.status === "live"
      ? "done"
      : release.status === "rolling-out"
        ? "current"
        : release.status === "pulled"
          ? "failed"
          : "pending",
  )

  const checkSummary = $derived(
    checking && !release.checks.length
      ? "Running now. This usually takes a few minutes."
      : failed.length
        ? `${plural(failed.length, "check")} failed${warnings.length ? `, ${plural(warnings.length, "warning")}` : ""}`
        : warnings.length
          ? `Passed with ${plural(warnings.length, "warning")}`
          : checking
            ? `${release.checks.length} done, more running`
            : `All ${plural(release.checks.length, "check")} passed`,
  )
</script>

<section class="rounded-group bg-raised p-5 sm:p-7">
  {#if header}{@render header()}{/if}

  {#if release.next}
    <div class="mb-6 rounded-2xl bg-[color-mix(in_oklab,var(--danger)_9%,transparent)] p-4" role="note">
      <p class="font-medium">What to do next</p>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">{release.next}</p>
    </div>
  {/if}

  <ol>
    <Step state="done" title={release.promoted_from ? "Promoted" : release.origin === "oidc" ? "Built on GitHub" : "Uploaded by you"}>
      <p>{systems} · {ago(release.created_at)}</p>
      {#if release.run_url}
        <a href={release.run_url} target="_blank" rel="noreferrer" class="mt-1 inline-flex items-center gap-1 text-accent hover:underline">Workflow run<ArrowUpRight class="size-3.5" /></a>
      {/if}
    </Step>

    <Step state={checkState} title="Checked">
      <button type="button" class="flex items-center gap-1.5 hover:text-ink" aria-expanded={checksOpen} onclick={() => (showChecks = !checksOpen)}>
        {checkSummary}
        {#if release.checks.length}<ChevronDown class="size-4 transition-transform {checksOpen ? 'rotate-180' : ''}" />{/if}
      </button>
      <div class="disclosure grid {checksOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}" inert={!checksOpen}>
        <ul class="min-h-0 overflow-hidden">
          {#each sortedChecks as check (check.name)}
            <CheckRow {check} {appId} widened={check.name === "permissions" && release.permissions_widened} />
          {/each}
        </ul>
      </div>
    </Step>

    <Step state={reviewState} title={release.status === "changes-requested" ? "Changes requested" : release.status === "rejected" ? "Rejected" : shipped ? (release.approved_by === AUTOMATIC_REVIEWER ? "Checked and out" : "Approved") : "Review"}>
      {#if review?.reason}
        <p class="text-ink-soft">{review.reason}</p>
      {:else if shipped && release.approved_at}
        <p>{release.approved_by === AUTOMATIC_REVIEWER ? "Went out on its checks" : "Approved"} {ago(release.approved_at)}</p>
      {:else if release.status === "in-review"}
        <p>A person is looking at it. First releases usually take a day; updates are quicker.</p>
      {:else if failed.length}
        <p>Starts once every check passes.</p>
      {:else}
        <p>Starts once the checks finish.</p>
      {/if}
    </Step>

    <Step state={rolloutState} title={release.status === "live" ? "Out to everyone" : release.status === "withdrawn" ? "Withdrawn" : release.status === "pulled" ? "Stopped by Schelf" : "Rollout"} last>
      {#if release.status === "rolling-out" || release.status === "live"}
        <Rollout {appId} {release} {previous} {onchange} />
      {:else if release.status === "withdrawn"}
        <p>Rolled back. People were offered the previous version.</p>
      {:else}
        <p>10%, 25%, 50%, then everyone, a day apart.</p>
      {/if}
    </Step>
  </ol>
</section>

<style>
  .disclosure {
    transition: grid-template-rows var(--spring-smooth-duration) var(--spring-smooth);
  }
</style>
