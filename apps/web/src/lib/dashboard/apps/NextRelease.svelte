<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"

  let { app, version }: { app: AppSettings["app"]; version: string | null } = $props()

  const next = $derived.by(() => {
    if (!version) return "v1.0.0"
    const parts = version.split(".").map(Number)
    if (parts.some(Number.isNaN)) return `v${version}`
    parts[parts.length - 1]! += 1
    return `v${parts.join(".")}`
  })
</script>

<section class="rounded-group bg-raised p-5 sm:p-6">
  <h2 class="font-semibold">Ship the next one</h2>
  <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">Publish a GitHub release and the rest happens on its own.</p>
  <div class="mt-4">
    <CodeBlock lang="sh" code={`gh release create ${next} --generate-notes`} />
  </div>
  <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">
    Your workflow builds every system, Schelf checks it and a person reviews it. You'll get an email when it's out.
  </p>
  {#if app.repository}
    <a href="https://github.com/{app.repository}/releases/new" target="_blank" rel="noreferrer" class="button button-sm button-quiet mt-4">Draft a release on GitHub</a>
  {/if}
</section>
