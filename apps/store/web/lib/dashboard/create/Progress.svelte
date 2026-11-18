<script lang="ts">
  import { STEP_TITLES, type Step } from "./kinds.ts"

  let { steps, current }: { steps: Step[]; current: number } = $props()
</script>

<div aria-label="Step {current + 1} of {steps.length}: {STEP_TITLES[steps[current]!]}" role="group">
  <p class="text-[13px] text-ink-muted tabular" aria-hidden="true">
    {#if steps.length > 1}Step {current + 1} of {steps.length}{:else}New project{/if}
  </p>
  <ol class="mt-2.5 flex gap-1.5 {steps.length > 1 ? '' : 'invisible'}" aria-hidden="true">
    {#each steps as step, index (step)}
      <li class="h-1 flex-1 overflow-hidden rounded-full bg-well">
        <span class="bar block h-full rounded-full bg-accent" style:width={index <= current ? "100%" : "0%"}></span>
      </li>
    {/each}
  </ol>
</div>

<style>
  .bar {
    transition: width var(--motion-large) var(--ease-decelerate);
  }
</style>
