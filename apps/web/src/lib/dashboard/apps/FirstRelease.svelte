<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import SetupFiles from "./SetupFiles.svelte"

  let { settings }: { settings: AppSettings } = $props()
</script>

<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
  <section class="min-w-0">
    <h2 class="text-xl font-semibold">Waiting for your first release</h2>
    <p class="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
      Commit these two files to <span class="font-mono text-[13px]">{settings.app.repository ?? "your repository"}</span> if you haven't yet, then publish a
      GitHub release. It shows up here within a minute of your workflow finishing.
    </p>
    <div class="mt-6"><SetupFiles setup={settings.setup} /></div>
  </section>
  <aside class="space-y-6">
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">Or let the command do it</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">In your repository, this writes both files for you.</p>
      <div class="mt-4"><CodeBlock lang="sh" code="bunx schelf init" /></div>
    </section>
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">Then release</h2>
      <div class="mt-4"><CodeBlock lang="sh" code="gh release create v1.0.0 --generate-notes" /></div>
      <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">Before it goes to review, make sure the <a href="/dashboard/apps/{settings.app.id}/listing" class="link">listing</a> has a description and at least two screenshots.</p>
    </section>
  </aside>
</div>
