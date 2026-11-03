<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"

  let { app }: { app: AppSettings["app"] } = $props()
  const extension = $derived(app.kind === "extension")
  const path = $derived(`schelf.store/${extension ? "extensions" : "apps"}/${app.id}`)
</script>

<section class="rounded-group bg-raised p-5 sm:p-6">
  <h2 class="font-semibold">Where it goes</h2>
  <dl class="mt-4 space-y-3 text-[15px]">
    <div class="flex justify-between gap-4"><dt class="shrink-0">Schelf on Luft</dt><dd class="text-ink-muted">Installs and updates</dd></div>
    {#if !extension}
      <div class="flex justify-between gap-4"><dt class="shrink-0">Download page</dt><dd class="min-w-0 truncate text-ink-muted">{path}</dd></div>
      {#if app.format === "sabine"}
        <div class="flex justify-between gap-4"><dt class="shrink-0">Built-in updates</dt><dd class="text-ink-muted">Windows, macOS</dd></div>
      {/if}
    {/if}
  </dl>
</section>
