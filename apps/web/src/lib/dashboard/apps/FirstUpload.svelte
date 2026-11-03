<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import SetupFiles from "./SetupFiles.svelte"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
</script>

<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
  <section class="min-w-0">
    <h2 class="text-xl font-semibold">Send the first release</h2>
    <p class="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
      From GitHub Actions, commit these files{app.repository ? ` to ${app.repository}` : ""} and publish a GitHub release with your build attached. The workflow sends its files to Schelf, and {app.visibility === "listed" ? "a person reviews them" : "they go out once Schelf's checks pass"}.
    </p>
    {#if !settings.trusted_publishers.length}
      <p class="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        First, add the repository and workflow under <a href="/dashboard/apps/{app.id}/publishing" class="link">Publishing</a>, so Schelf knows the release is yours.
      </p>
    {/if}
    <div class="mt-6"><SetupFiles setup={settings.setup} /></div>
  </section>
  <aside class="space-y-6">
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">Or upload it</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">Built somewhere else? Upload the files here. A person reviews every upload.</p>
      <a href="/dashboard/apps/{app.id}/upload" class="button button-sm button-quiet mt-4">Upload a release</a>
    </section>
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">Your download link</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">Works as soon as the first release is out. More on the <a href="/dashboard/apps/{app.id}/hosting" class="link">Links</a> tab.</p>
      <div class="mt-4"><CodeBlock lang="sh" code={settings.links.latest} /></div>
    </section>
  </aside>
</div>
