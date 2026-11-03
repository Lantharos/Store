<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"

  let { settings, version }: { settings: AppSettings; version: string | null } = $props()
  const app = $derived(settings.app)
  const repository = $derived(settings.trusted_publishers[0]?.repository)

  const next = $derived.by(() => {
    if (!version) return "v1.0.0"
    const parts = version.split(".").map(Number)
    if (parts.some(Number.isNaN)) return `v${version}`
    parts[parts.length - 1]! += 1
    return `v${parts.join(".")}`
  })
</script>

<section>
  <h2 class="px-1 font-semibold">Ship the next one</h2>
  <div class="mt-2.5 rounded-group bg-raised p-5">
    {#if repository}
      <p class="text-[15px] leading-relaxed text-ink-soft">Publish a GitHub release on {repository} and the rest happens on its own.</p>
      <div class="mt-4"><CodeBlock lang="sh" code={`gh release create ${next} --generate-notes`} /></div>
      <a href="https://github.com/{repository}/releases/new" target="_blank" rel="noreferrer" class="button button-sm button-quiet mt-4">Draft it on GitHub</a>
    {:else if app.kind === "extension"}
      <p class="text-[15px] leading-relaxed text-ink-soft">Send it from your project with a token.</p>
      <div class="mt-4"><CodeBlock lang="sh" code={`bunx schelf publish --tag ${next} dist/*.tar.zst`} /></div>
    {:else}
      <p class="text-[15px] leading-relaxed text-ink-soft">Upload the files, or send them with schelf publish and a token. A person reviews each one.</p>
      <a href="/dashboard/apps/{app.id}/upload" class="button button-sm button-quiet mt-4">Upload {next.slice(1)}</a>
    {/if}
  </div>
</section>
