<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import { PLATFORM_NAMES } from "../../system/artifacts.ts"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { schelfFile } from "../files/files.ts"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const file = $derived(schelfFile(settings) ?? "schelf.toml")
  const parts = $derived(Object.entries(app.parts))
  const names = (platforms: string[]) =>
    platforms.map((platform) => PLATFORM_NAMES[platform as keyof typeof PLATFORM_NAMES]).join(", ")
</script>

{#if app.platforms || parts.length}
  <Group title="Systems" rows>
    <Row
      title={app.platforms ? "The app" : "Only named parts"}
      description={app.platforms ? names(app.platforms) : "No store page or install button, just the parts' downloads."}
    >
      <span class="font-mono text-[12px] text-ink-muted">{file} · platforms</span>
    </Row>
    {#each parts as [name, part] (name)}
      <Row title={name} description={names(part.platforms)}>
        <span class="font-mono text-[12px] text-ink-muted">{file} · parts.{name}</span>
      </Row>
    {/each}
  </Group>
{/if}
