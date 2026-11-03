<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import SetupFiles from "./SetupFiles.svelte"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const fromGitHub = $derived(settings.trusted_publishers.length > 0)
  const repository = $derived(settings.trusted_publishers[0]?.repository ?? app.repository)
</script>

{#if fromGitHub}
  <ol class="space-y-10">
    <li>
      <h3 class="font-semibold">Add two files to {repository}</h3>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">They tell your workflow how to build {app.name} and send it to Schelf.</p>
      <div class="mt-4"><SetupFiles setup={settings.setup} /></div>
      <p class="mt-5 text-[15px] text-ink-soft">Or let the command write them, run in the repository:</p>
      <div class="mt-3"><CodeBlock lang="sh" code="bunx schelf init" /></div>
    </li>
    <li>
      <h3 class="font-semibold">Publish a GitHub release</h3>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">It shows up here within a minute of the workflow finishing.</p>
      <div class="mt-4"><CodeBlock lang="sh" code="gh release create v1.0.0 --generate-notes" /></div>
    </li>
  </ol>
{:else}
  {#if app.kind !== "extension"}
    <h3 class="font-semibold">Upload the files</h3>
    <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">Installers, archives or programs, for as many systems as you have. A person reviews every upload, usually within a day.</p>
    <a href="/dashboard/apps/{app.id}/upload" class="button button-primary mt-5">Upload the first release</a>
    <h3 class="mt-10 font-semibold">Or send them from a terminal</h3>
  {:else}
    <h3 class="font-semibold">Send it from a terminal</h3>
  {/if}
  <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">
    Make a token under <a href="/dashboard/apps/{app.id}/settings" class="link">Settings</a>, save this file in your project, and publish with the token. A person reviews every release sent this way.
  </p>
  <div class="mt-4 space-y-4">
    <CodeBlock title="schelf.toml" lang="toml" code={settings.setup.schelf_toml} />
    <CodeBlock lang="sh" code={`SCHELF_TOKEN=schelf_… bunx schelf publish --tag v1.0.0 ${app.kind === "extension" ? "dist/*.tar.zst" : "dist/*"}`} />
  </div>
{/if}
