<script lang="ts">
  import type { AppSettings, Channel } from "@schelf/protocol"
  import { plural } from "../../format.ts"
  import Select from "../../ui/fields/Select.svelte"
  import Switch from "../../ui/fields/Switch.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { schelfFile } from "../files/files.ts"
  import EndChannel from "./EndChannel.svelte"

  let { settings = $bindable() }: { settings: AppSettings } = $props()

  const KEEP = [
    { value: "all", label: "Keep every release" },
    ...[3, 5, 10, 20, 50].map((count) => ({ value: String(count), label: `Keep the last ${count}` })),
  ]

  const file = $derived(schelfFile(settings))
  let ending = $state<Channel>()
  let endOpen = $state(false)
  let reopening = $state<Channel>()
  let reopenOpen = $state(false)

  function end(channel: Channel) {
    ending = channel
    endOpen = true
  }

  function askToReopen(channel: Channel) {
    reopening = channel
    reopenOpen = true
  }

  async function reopen() {
    settings = await api.post<AppSettings>(endpoints.reopenChannel(settings.app.id, reopening!.name))
  }

  const describe = (channel: Channel) =>
    channel.ended_into
      ? `Ended, people on it follow ${channel.ended_into}. ${plural(channel.releases, "release")}`
      : plural(channel.releases, "release")

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
    <Row title={channel.name} description={describe(channel)}>
      {#if file}
        <span class="text-[15px] text-ink-soft">
          {channel.gradual ? "Step by step" : "Everyone at once"}{#if channel.name !== "stable"}, {channel.keep === null ? "keeps every release" : `keeps the last ${channel.keep}`}{/if}
          <span class="ml-2 font-mono text-[12px] text-ink-muted">{file} · channels.{channel.name}</span>
        </span>
      {:else if !channel.ended_into}
        <label class="flex items-center gap-3 text-[15px] text-ink-soft">
          Step by step
          <Switch label="Roll out {channel.name} releases step by step" checked={channel.gradual} onchange={(gradual) => change(channel.name, { gradual })} />
        </label>
      {/if}
      {#if channel.name !== "stable" && !file}
        <div class="w-56">
          <Select label="How many {channel.name} releases to keep" value={channel.keep === null ? "all" : String(channel.keep)} options={KEEP} onchange={(value) => change(channel.name, { keep: value === "all" ? null : Number(value) })} />
        </div>
      {/if}
      {#snippet below()}
        {#if channel.name !== "stable" && session.can("releases") && !file}
          <div class="flex justify-end">
            {#if channel.ended_into}
              <button type="button" class="button button-sm button-quiet" onclick={() => askToReopen(channel)}>Reopen</button>
            {:else}
              <button type="button" class="button button-sm button-quiet" onclick={() => end(channel)}>End channel</button>
            {/if}
          </div>
        {/if}
      {/snippet}
    </Row>
  {/each}
</Group>

{#if ending}{#key ending.name}<EndChannel bind:open={endOpen} channel={ending} bind:settings />{/key}{/if}

<Confirm bind:open={reopenOpen} title="Reopen {reopening?.name}?" confirm="Reopen" onconfirm={reopen}>
  People who were moved off {reopening?.name} come back on their next update check, and you can publish to it again.
  {#if settings.app.updater === "electron"}Apps set to this channel with electron-updater accept a lower version from it, so have a newer {reopening?.name} release ready.{/if}
</Confirm>
