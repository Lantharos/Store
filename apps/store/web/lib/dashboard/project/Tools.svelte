<script lang="ts">
  import type { AppSettings, ProjectTool, PublisherTool } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { schelfFile } from "../files/files.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const file = $derived(schelfFile(settings) ?? "schelf.toml")
  let claiming = $state<ProjectTool>()
  let asking = $state(false)

  const SHORT: Record<ProjectTool["short"], string> = {
    resolves: "Answers to its bare name",
    paused: "Its bare name waits until you're verified again",
    free: "Its bare name is free",
    taken: "Another publisher has its bare name",
    reserved: "Its bare name is kept for the system",
  }

  async function claim() {
    const tools = await api.post<PublisherTool[]>(endpoints.toolNames(settings.app.publisher), {
      name: claiming!.name,
    })
    settings = {
      ...settings,
      tools: settings.tools.map((tool) => tools.find((each) => each.address === tool.address) ?? tool),
    }
  }
</script>

{#if settings.tools.length}
  <Group title="Command-line tools" rows>
    {#each settings.tools as tool (tool.name)}
      <Row title={tool.address} description={SHORT[tool.short]}>
        {#if tool.short === "free" && session.can("apps")}
          <button type="button" class="button button-sm button-quiet" onclick={() => ((claiming = tool), (asking = true))}>Use {tool.name}</button>
        {:else}
          <span class="font-mono text-[12px] text-ink-muted">{file} · {tool.part ? `parts.${tool.part}.tool` : "tool"}</span>
        {/if}
        {#snippet below()}
          {#each [tool.install, tool.add] as line (line)}
            <div class="flex items-center gap-2">
              <code class="min-w-0 flex-1 truncate font-mono text-[13px] text-ink-soft" title={line}>{line}</code>
              <CopyButton text={line} compact />
            </div>
          {/each}
        {/snippet}
      </Row>
    {/each}
  </Group>
  <Confirm bind:open={asking} title="Use {claiming?.name} on its own" confirm="Use it" onconfirm={claim}>
    {claiming?.name} will install {claiming?.address} for everyone, first come. It stays yours, and works while you're verified.
  </Confirm>
{/if}
