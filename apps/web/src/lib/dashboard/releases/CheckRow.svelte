<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import CircleX from "@lucide/svelte/icons/circle-x"
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert"
  import { CHECK_TITLES, type CheckResult } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { CHECK_FIXES } from "./checks.ts"

  let {
    check,
    appId,
    widened,
    uploaded,
  }: { check: CheckResult; appId: string; widened: boolean; uploaded: boolean } = $props()
  const expected = $derived(uploaded && check.name === "attestation")
  const fix = $derived((check.status === "passed" && !widened) || expected ? null : CHECK_FIXES[check.name])
  const fixHref = $derived(
    fix?.href ?? (check.name === "listing" ? `/dashboard/apps/${appId}/listing` : undefined),
  )
  let details = $state(false)
</script>

<li class="flex gap-3 border-t border-hairline py-3 first:mt-3">
  {#if check.status === "passed"}
    <CircleCheck class="mt-0.5 size-[18px] shrink-0 text-accent" />
  {:else if check.status === "warning"}
    <TriangleAlert class="mt-0.5 size-[18px] shrink-0 text-caution" />
  {:else}
    <CircleX class="mt-0.5 size-[18px] shrink-0 text-danger" />
  {/if}
  <div class="min-w-0 flex-1">
    <p class="flex flex-wrap items-baseline justify-between gap-x-4">
      <span class="text-ink">{CHECK_TITLES[check.name]}</span>
      <span class="text-[13px] {check.status === 'failed' ? 'text-danger' : check.status === 'warning' ? 'text-caution' : 'text-ink-muted'}">
        {check.status === "passed" ? "Passed" : check.status === "warning" ? "Warning" : "Failed"}
      </span>
    </p>
    <p class="mt-0.5 text-ink-soft">
      {check.summary}
      {#if check.detail !== undefined}<button type="button" class="ml-1 text-[13px] text-accent hover:underline" onclick={() => (details = true)}>Details</button>{/if}
    </p>
    {#if fix}
      <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
        {fix.text}
        {#if fixHref}<a href={fixHref} class="ml-1 text-accent hover:underline">{fix.link ?? "Fix it"}</a>{/if}
      </p>
    {/if}
  </div>
</li>

{#if check.detail !== undefined}
  <Dialog bind:open={details} class="max-w-2xl" label="{CHECK_TITLES[check.name]} in detail">
    <div class="space-y-4 p-6 sm:p-7">
      <h2 class="font-semibold">{CHECK_TITLES[check.name]}</h2>
      <CodeBlock title="{check.name}.json" lang="json" code={JSON.stringify(check.detail, null, 2)} />
      <div class="flex justify-end"><button type="button" class="button button-primary" onclick={() => (details = false)}>Done</button></div>
    </div>
  </Dialog>
{/if}
