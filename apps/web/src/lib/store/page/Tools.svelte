<script lang="ts">
  import type { ProjectTool, PublisherSummary } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"

  let { tools, publisher }: { tools: ProjectTool[]; publisher: PublisherSummary } = $props()
</script>

{#each tools as tool (tool.name)}
  <section class="mt-8 rounded-tile bg-well p-5 sm:p-7" aria-label="Install {tool.name}">
    <h2 class="font-semibold">{tool.name} <span class="font-normal text-ink-muted">in your terminal</span></h2>
    <div class="mt-4 space-y-2">
      {#each [tool.install, tool.add] as line (line)}
        <div class="flex items-center gap-3 rounded-lg bg-raised py-1.5 pr-1.5 pl-4">
          <code class="min-w-0 flex-1 truncate font-mono text-[13px]" title={line}>{line}</code>
          <CopyButton text={line} compact />
        </div>
      {/each}
    </div>
    <p class="mt-3 text-[13px] text-ink-muted">
      Runs with everything you can do. Published by {publisher.name}{publisher.verified ? ", a verified publisher" : ", whom Schelf hasn't verified"}.
    </p>
  </section>
{/each}
