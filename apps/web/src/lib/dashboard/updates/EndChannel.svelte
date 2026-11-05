<script lang="ts">
  import type { AppSettings, Channel } from "@schelf/protocol"
  import Select from "../../ui/fields/Select.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let {
    open = $bindable(false),
    channel,
    settings = $bindable(),
  }: { open?: boolean; channel: Channel; settings: AppSettings } = $props()

  const destinations = $derived(
    settings.channels.filter((each) => each.name !== channel.name && !each.ended_into),
  )
  let into = $state<string>("stable")
  const empty = $derived(destinations.find((each) => each.name === into)?.releases === 0)

  async function end() {
    settings = await api.post<AppSettings>(endpoints.endChannel(settings.app.id, channel.name), { into })
  }
</script>

<Confirm bind:open title="End {channel.name}?" confirm="End {channel.name}" danger onconfirm={end}>
  <p>Where should people on {channel.name} go?</p>
  <div class="mt-3">
    <Select label="Where people on {channel.name} go" bind:value={into} options={destinations.map(({ name }) => ({ value: name, label: name }))} />
  </div>
  <ul class="mt-4 space-y-2">
    <li>Everyone following {channel.name} moves to {into} on their next update check. Anyone on a newer build keeps it until {into} catches up.</li>
    <li>Its download links and update feeds keep working and answer with {into}.</li>
    <li>Nothing new can be published to {channel.name} until you reopen it. Its old releases stay in your history.</li>
    {#if empty}<li class="text-ink">{into} has no releases yet, so links keep serving {channel.name}'s until it does.</li>{/if}
  </ul>
</Confirm>
