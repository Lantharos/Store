<script lang="ts">
  import type { Snippet } from "svelte"
  import Dialog from "./Dialog.svelte"

  let {
    open = $bindable(false),
    title,
    confirm,
    danger = false,
    onconfirm,
    children,
  }: {
    open?: boolean
    title: string
    confirm: string
    danger?: boolean
    onconfirm: () => unknown
    children?: Snippet
  } = $props()

  let busy = $state(false)

  async function run() {
    busy = true
    try {
      await onconfirm()
      open = false
    } finally {
      busy = false
    }
  }
</script>

<Dialog bind:open>
  <div class="p-6 sm:p-7">
    <h2 class="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
    {#if children}<div class="mt-2 text-[15px] leading-relaxed text-ink-soft">{@render children()}</div>{/if}
    <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" class="button button-quiet" onclick={() => (open = false)}>Cancel</button>
      <button type="button" class="button {danger ? 'button-danger' : 'button-primary'}" disabled={busy} onclick={run}>
        {confirm}
      </button>
    </div>
  </div>
</Dialog>
