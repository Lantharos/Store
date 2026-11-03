<script lang="ts">
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import Channels from "#lib/dashboard/updates/Channels.svelte"
  import { frameworkName } from "#lib/dashboard/updates/framework.ts"
  import HowItUpdates from "#lib/dashboard/updates/HowItUpdates.svelte"
  import MoveProgress from "#lib/dashboard/updates/MoveProgress.svelte"
  import { date } from "#lib/format.ts"

  const settings = $derived(appSettings()())
  const data = $derived(settings.data!)
  const move = $derived(data.switches.find((entry) => !entry.completed_at))
  const finished = $derived(data.switches.filter((entry) => entry.completed_at))
</script>

<svelte:head><title>Updates · {data.app.name} · Schelf for developers</title></svelte:head>

<div class="max-w-3xl space-y-12">
  {#if move}
    <MoveProgress bind:settings={() => data, (next) => settings.set(next)} {move} />
  {/if}

  <div>
    <HowItUpdates settings={data} />
    {#each finished as entry (entry.id)}
      <p class="mt-3 px-1 text-[13px] text-ink-muted">Moved from {frameworkName(entry.from)} to {frameworkName(entry.to)} on {date(entry.completed_at!)}.</p>
    {/each}
  </div>

  <Channels bind:settings={() => data, (next) => settings.set(next)} />
</div>
