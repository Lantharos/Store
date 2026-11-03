<script lang="ts">
  import Check from "@lucide/svelte/icons/check"

  let { steps, current }: { steps: string[]; current: number } = $props()
</script>

<ol class="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px]" aria-label="Steps">
  {#each steps as step, index (step)}
    <li class="flex items-center gap-2" aria-current={index === current ? "step" : undefined}>
      <span
        class="grid size-6 place-items-center rounded-full text-[13px] font-semibold tabular transition-colors {index < current
          ? 'bg-accent text-accent-ink'
          : index === current
            ? 'bg-ink text-canvas'
            : 'bg-well text-ink-muted'}"
      >
        {#if index < current}<Check class="size-3.5" strokeWidth={3} />{:else}{index + 1}{/if}
      </span>
      <span class={index === current ? "text-ink" : "text-ink-muted max-sm:hidden"}>{step}</span>
      {#if index < steps.length - 1}<span class="mx-1 h-px w-6 bg-hairline"></span>{/if}
    </li>
  {/each}
</ol>
