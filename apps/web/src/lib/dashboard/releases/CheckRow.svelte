<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import CircleX from "@lucide/svelte/icons/circle-x"
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert"
  import type { CheckResult } from "@schelf/protocol"
  import { CHECK_FIXES } from "./checks.ts"
  import { CHECK_TITLES } from "./status.ts"

  let { check, appId, widened }: { check: CheckResult; appId: string; widened: boolean } = $props()
  const fix = $derived(check.status === "passed" && !widened ? null : CHECK_FIXES[check.name])
  const fixHref = $derived(
    fix?.href ?? (check.name === "listing" ? `/dashboard/apps/${appId}/listing` : undefined),
  )
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
    <p class="mt-0.5 text-ink-soft">{check.summary}</p>
    {#if fix}
      <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
        {fix.text}
        {#if fixHref}<a href={fixHref} class="ml-1 text-accent hover:underline">{fix.link ?? "Fix it"}</a>{/if}
      </p>
    {/if}
  </div>
</li>
