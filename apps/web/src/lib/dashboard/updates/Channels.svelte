<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import { plural } from "../../format.ts"
  import Select from "../../ui/fields/Select.svelte"
  import Switch from "../../ui/fields/Switch.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()

  const KEEP = [
    { value: "all", label: "Keep every release" },
    ...[3, 5, 10, 20, 50].map((count) => ({ value: String(count), label: `Keep the last ${count}` })),
  ]

  async function change(channel: string, changes: { keep?: number | null; gradual?: boolean }) {
    try {
      settings = await api.patch<AppSettings>(endpoints.channel(settings.app.id, channel), changes)
    } catch (error) {
      toasts.show((error as Error).message, "danger")
    }
  }
</script>

<Group
  title="Channels"
  description="A release goes to stable, or to the channel its version names, like 2.0.0-beta.1. To move a shipped release to another channel, open it and choose Promote."
  rows
>
  {#each settings.channels as channel (channel.name)}
    <Row title={channel.name} description={plural(channel.releases, "release")}>
      <label class="flex items-center gap-3 text-[15px] text-ink-soft">
        Step by step
        <Switch label="Roll out {channel.name} releases step by step" checked={channel.gradual} onchange={(gradual) => change(channel.name, { gradual })} />
      </label>
      {#if channel.name !== "stable"}
        <div class="w-56">
          <Select label="How many {channel.name} releases to keep" value={channel.keep === null ? "all" : String(channel.keep)} options={KEEP} onchange={(value) => change(channel.name, { keep: value === "all" ? null : Number(value) })} />
        </div>
      {/if}
    </Row>
  {/each}
</Group>
