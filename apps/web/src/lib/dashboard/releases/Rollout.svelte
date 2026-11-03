<script lang="ts">
  import type { ReleaseDetail, RolloutRequest } from "@schelf/protocol"
  import Checkbox from "../../ui/fields/Checkbox.svelte"
  import Slider from "../../ui/fields/Slider.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { dayName, everyoneBy } from "./rollout.ts"

  let {
    appId,
    release,
    previous,
    onchange,
  }: {
    appId: string
    release: ReleaseDetail
    previous: string | null
    onchange: (release: ReleaseDetail) => void
  } = $props()

  let setting = $state(false)
  let releasing = $state(false)
  let rolling = $state(false)
  let percent = $state(50)
  let unsafe = $state(false)
  const live = $derived(release.status === "live")
  const by = $derived(everyoneBy(release))

  async function send(request: RolloutRequest, optimistic: Partial<ReleaseDetail>) {
    const before = release
    onchange({ ...release, ...optimistic })
    try {
      onchange(await api.post<ReleaseDetail>(endpoints.rollout(appId, release.id), request))
    } catch (error) {
      onchange(before)
      throw error
    }
  }

  function togglePause() {
    const paused = !release.rollout_paused
    send({ action: paused ? "pause" : "resume" }, { rollout_paused: paused }).then(
      () =>
        toasts.show(paused ? `Paused at ${release.rollout_percent}%` : "Rollout resumed", "neutral", {
          label: "Undo",
          run: () =>
            send({ action: paused ? "resume" : "pause" }, { rollout_paused: !paused }).catch((error) =>
              toasts.error(error),
            ),
        }),
      (error) => toasts.error(error),
    )
  }
</script>

<div class="text-ink-soft">
  <p class="flex flex-wrap items-baseline justify-between gap-x-4">
    <span class="tabular">
      {#if live}Everyone has it{:else if release.rollout_paused}Paused at {release.rollout_percent}%{:else}{release.rollout_percent}% of people{/if}
    </span>
    {#if by}<span class="text-[13px] text-ink-muted">Reaches everyone {dayName(by)}</span>{/if}
  </p>
  <div class="mt-3 h-2 overflow-hidden rounded-full bg-well" role="progressbar" aria-label="Rollout" aria-valuenow={release.rollout_percent} aria-valuemin={0} aria-valuemax={100}>
    <div class="bar h-full rounded-full {release.rollout_paused ? 'bg-caution' : 'bg-accent'}" style:width="{release.rollout_percent}%"></div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">
    {#if !live}
      <button type="button" class="button button-sm button-quiet" onclick={togglePause}>{release.rollout_paused ? "Resume" : "Pause"}</button>
      <button type="button" class="button button-sm button-quiet" onclick={() => ((percent = Math.max(release.rollout_percent, 50)), (setting = true))}>Set percentage</button>
      <button type="button" class="button button-sm button-quiet" onclick={() => (releasing = true)}>Release to everyone</button>
    {/if}
    {#if previous}
      <button type="button" class="button button-sm button-quiet" onclick={() => ((unsafe = false), (rolling = true))}>Roll back to {previous}</button>
    {/if}
  </div>
</div>

<Confirm
  bind:open={setting}
  title="Set the rollout"
  confirm="Set to {percent}%"
  onconfirm={() => send({ action: "set", percent }, { rollout_percent: percent })}
>
  <p>Devices whose number falls under the percentage get {release.version}. It keeps rising a step a day from there unless you pause it.</p>
  <div class="mt-6">
    <Slider bind:value={percent} min={1} max={100} stops={[10, 25, 50, 75, 100]} label="Rollout percentage" format={(value) => `${value}%`} />
  </div>
</Confirm>

<Confirm
  bind:open={releasing}
  title="Release {release.version} to everyone?"
  confirm="Release to everyone"
  onconfirm={() => send({ action: "all" }, { rollout_percent: 100, status: "live" })}
>
  <p>Everyone gets it on their next update check, within about six hours. Use this for security fixes, or once you're confident in it.</p>
</Confirm>

<Confirm
  bind:open={rolling}
  title="Roll back to {previous}?"
  confirm="Roll back"
  danger
  onconfirm={() => send({ action: "rollback", unsafe }, { status: "withdrawn" })}
>
  <p>{release.version} is withdrawn. People who haven't updated stay where they are, and people who have it are offered {previous}.</p>
  <div class="mt-4">
    <Checkbox bind:checked={unsafe}>Don't offer {previous}: it isn't safe either. People stay put and get your next fix.</Checkbox>
  </div>
</Confirm>

<style>
  .bar {
    transition: width var(--spring-smooth-duration) var(--spring-smooth);
  }
</style>
