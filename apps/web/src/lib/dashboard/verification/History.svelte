<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import X from "@lucide/svelte/icons/x"
  import type { Verification, VerificationEvent } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import Group from "../../ui/group/Group.svelte"
  import Step, { type StepState } from "../releases/Step.svelte"

  let { verification }: { verification: Verification } = $props()

  const TITLES: Record<VerificationEvent["kind"], string> = {
    submitted: "Sent for review",
    checked: "Checked",
    "more-requested": "Schelf asked for more",
    replied: "You answered",
    message: "Message from Schelf",
    approved: "Verified",
    rejected: "Not verified",
    revoked: "No longer verified",
  }

  function stateOf(event: VerificationEvent): StepState {
    if (event.kind === "rejected" || event.kind === "revoked") return "failed"
    if (event.kind === "checked" && event.checks?.some((check) => !check.passed)) return "failed"
    return "done"
  }

  const waiting = $derived(
    verification.status === "open"
      ? { title: "Review", text: "A person at Schelf is checking it, usually within three days." }
      : verification.status === "more-requested"
        ? {
            title: "Waiting for your answer",
            text: "Answer above, and change the details if that's what was asked.",
          }
        : null,
  )
</script>

<Group title="History">
  <ol>
    {#each verification.history as event, index (index)}
      <Step state={stateOf(event)} title={event.kind === "replied" && event.by ? `${event.by} answered` : TITLES[event.kind]} last={!waiting && index === verification.history.length - 1}>
        <p>{date(event.at)}</p>
        {#if event.checks}
          <ul class="mt-2 space-y-1">
            {#each event.checks as check (check.label)}
              <li class="flex items-center gap-2 {check.passed ? '' : 'text-ink-soft'}">
                {#if check.passed}<Check class="size-4 shrink-0 text-accent" />{:else}<X class="size-4 shrink-0 text-danger" />{/if}
                {check.label}
              </li>
            {/each}
          </ul>
        {/if}
        {#if event.text}
          <p class="mt-2 rounded-2xl bg-well px-4 py-3 leading-relaxed whitespace-pre-line text-ink">{event.text}</p>
        {/if}
      </Step>
    {/each}
    {#if waiting}
      <Step state="current" title={waiting.title} last><p>{waiting.text}</p></Step>
    {/if}
  </ol>
</Group>
