<script lang="ts" module>
  export type StepState = "done" | "current" | "failed" | "pending"
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import X from "@lucide/svelte/icons/x"
  import type { Snippet } from "svelte"

  let { state, title, last = false, children }: { state: StepState; title: string; last?: boolean; children: Snippet } = $props()
</script>

<li class="flex gap-4">
  <div class="flex flex-col items-center">
    {#if state === "done"}
      <span class="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><Check class="size-4" strokeWidth={3} /></span>
    {:else if state === "failed"}
      <span class="grid size-7 shrink-0 place-items-center rounded-full bg-danger text-canvas"><X class="size-4" strokeWidth={3} /></span>
    {:else if state === "current"}
      <span class="grid size-7 shrink-0 place-items-center rounded-full border-2 border-accent"><span class="pulse size-2.5 rounded-full bg-accent"></span></span>
    {:else}
      <span class="size-7 shrink-0 rounded-full border-2 border-well"></span>
    {/if}
    {#if !last}<span class="my-1 w-0.5 flex-1 rounded-full {state === 'done' ? 'bg-accent/45' : 'bg-well'}"></span>{/if}
  </div>
  <div class="min-w-0 flex-1 {last ? '' : 'pb-7'}">
    <p class="pt-0.5 font-medium {state === 'pending' ? 'text-ink-muted' : ''}">{title}</p>
    <div class="mt-0.5 text-[15px] text-ink-muted">{@render children()}</div>
  </div>
</li>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .pulse {
      animation: pulse 1.8s ease-in-out infinite;
    }
  }

  @keyframes pulse {
    50% {
      scale: 0.6;
      opacity: 0.6;
    }
  }
</style>
