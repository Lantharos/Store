<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { count } from "../../format.ts"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const extension = $derived(app.kind === "extension")
  const link = $derived(extension ? settings.links.page : settings.links.latest)
</script>

<section>
  <h2 class="px-1 font-semibold">{extension ? "Its page" : "Download link"}</h2>
  <div class="mt-2.5 rounded-group bg-raised p-5">
    <p class="truncate font-mono text-[13px] text-ink-soft" title={link}>{link.replace(/^https?:\/\//, "")}</p>
    <div class="mt-3 flex items-center gap-2">
      <CopyButton text={link} label="Copy link" />
      {#if !extension}<a href="/dashboard/apps/{app.id}/share" class="ml-auto text-[15px] text-accent hover:underline">More ways to share</a>{/if}
    </div>
    <p class="mt-4 border-t border-hairline pt-4 text-[15px] text-ink-soft">
      <a href="/dashboard/apps/{app.id}/stats" class="hover:text-ink"><span class="font-semibold text-ink tabular">{count(app.installs_7d)}</span> {app.format === "files" ? "downloads" : "installs"} in the last 7 days</a>
    </p>
  </div>
</section>
