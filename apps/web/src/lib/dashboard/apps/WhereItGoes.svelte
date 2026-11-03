<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import { frameworkName } from "../hosting/framework.ts"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const inSchelf = $derived(app.visibility === "listed" && app.format !== "files")
  const page = $derived(settings.links.page.replace(/^https?:\/\//, ""))
  const latest = $derived(settings.links.latest.replace(/^https?:\/\//, ""))
</script>

<section class="rounded-group bg-raised p-5 sm:p-6">
  <h2 class="font-semibold">Where it goes</h2>
  <dl class="mt-4 space-y-3 text-[15px]">
    {#if inSchelf}
      <div class="flex justify-between gap-4"><dt class="shrink-0">Schelf on Luft</dt><dd class="text-ink-muted">Installs and updates</dd></div>
    {/if}
    {#if app.kind !== "extension"}
      <div class="flex justify-between gap-4"><dt class="shrink-0">Page</dt><dd class="min-w-0 truncate text-ink-muted">{page}</dd></div>
      <div class="flex justify-between gap-4"><dt class="shrink-0">Download link</dt><dd class="min-w-0 truncate text-ink-muted">{latest}</dd></div>
      {#if app.updater}
        <div class="flex justify-between gap-4"><dt class="shrink-0">Updates</dt><dd class="text-ink-muted">{frameworkName(app.updater)}</dd></div>
      {/if}
    {/if}
  </dl>
  <a href="/dashboard/apps/{app.id}/hosting" class="mt-4 inline-block text-[15px] text-accent hover:underline">All links</a>
</section>
