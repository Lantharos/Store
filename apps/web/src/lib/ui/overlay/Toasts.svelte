<script lang="ts">
  import { flip } from "svelte/animate"
  import { fly } from "svelte/transition"
  import { toasts } from "./toasts.svelte.ts"

  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
</script>

<div role="status" aria-live="polite" class="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end">
  {#each toasts.list as toast (toast.id)}
    <div
      animate:flip={{ duration: still ? 0 : 250 }}
      transition:fly={{ y: still ? 0 : 12, duration: still ? 0 : 220 }}
      class="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-4 text-[15px] text-canvas shadow-float {toast.tone === 'danger' ? 'bg-danger' : 'bg-ink'} {toast.action ? '' : 'pr-4'}"
    >
      <button type="button" class="text-left" onclick={() => toasts.dismiss(toast.id)}>
        {toast.text}
      </button>
      {#if toast.action}
        <button
          type="button"
          class="rounded-full bg-canvas/15 px-3 py-1 text-sm font-semibold hover:bg-canvas/25"
          onclick={() => {
            toasts.dismiss(toast.id)
            void toast.action!.run()
          }}
        >
          {toast.action.label}
        </button>
      {/if}
    </div>
  {/each}
</div>
