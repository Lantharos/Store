<script lang="ts">
  import Dialog from "../../ui/overlay/Dialog.svelte"

  let { notes, version }: { notes: string; version: string } = $props()

  let open = $state(false)
</script>

<button type="button" class="button button-quiet w-full" onclick={() => (open = true)}>Show release notes</button>

<Dialog bind:open class="max-w-2xl">
  <div class="p-6 sm:p-7">
    <h2 class="text-xl font-semibold tracking-[-0.01em]">What's new in {version}</h2>
    {#await import("#lib/content/markdown.ts") then { renderUserMarkdown }}
      <div class="prose prose-compact mt-3 text-[15px]!">{@html renderUserMarkdown(notes)}</div>
    {/await}
    <div class="mt-6 flex justify-end">
      <button type="button" class="button button-quiet" onclick={() => (open = false)}>Close</button>
    </div>
  </div>
</Dialog>
