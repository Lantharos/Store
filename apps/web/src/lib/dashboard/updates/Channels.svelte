<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import { plural } from "../../format.ts"
  import Select from "../../ui/fields/Select.svelte"
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

  async function keep(channel: string, value: string) {
    try {
      settings = await api.patch<AppSettings>(endpoints.channel(settings.app.id, channel), {
        keep: value === "all" ? null : Number(value),
      })
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
      {#if channel.name !== "stable"}
        <div class="w-56">
          <Select label="How many {channel.name} releases to keep" value={channel.keep === null ? "all" : String(channel.keep)} options={KEEP} onchange={(value) => keep(channel.name, value)} />
        </div>
      {/if}
    </Row>
  {/each}
</Group>
