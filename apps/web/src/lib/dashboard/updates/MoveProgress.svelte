<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import type { AppSettings, UpdaterSwitch } from "@schelf/protocol"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { bridgeAdvice, frameworkName } from "./framework.ts"

  let { settings = $bindable(), move }: { settings: AppSettings; move: UpdaterSwitch } = $props()
  let busy = $state(false)
  const from = $derived(frameworkName(move.from))
  const to = $derived(frameworkName(move.to))
  const steps = $derived([
    {
      done: move.first_release,
      title: `The first release built with ${to}`,
      text: "Publish it as usual. New downloads get it straight away.",
    },
    {
      done: move.bridge_release,
      title: `A bridge built with ${from}`,
      text: `One last release the old way, sent with bridge: true in the action or schelf publish --bridge, whose only job is to install the new build. ${bridgeAdvice(move.from)}`,
    },
  ])

  async function stay() {
    busy = true
    try {
      settings = await api.delete<AppSettings>(endpoints.switchUpdater(settings.app.id))
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }
</script>

<section>
  <h2 class="px-1 font-semibold">Moving from {from} to {to}</h2>
  <p class="mt-0.5 px-1 text-[13px] leading-relaxed text-ink-muted">Copies already out there only listen to {from}. Ship these two, in either order, and nobody is left behind.</p>
  <ol class="mt-2.5 divide-y divide-hairline overflow-hidden rounded-group bg-raised">
    {#each steps as step, index (step.title)}
      <li class="flex gap-4 px-5 py-4">
        <span class="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular {step.done ? 'bg-accent text-accent-ink' : 'bg-well'}">
          {#if step.done}<Check class="size-4" strokeWidth={2.5} />{:else}{index + 1}{/if}
        </span>
        <span class="min-w-0">
          <span class="block font-medium">{step.title}</span>
          <span class="block text-[15px] leading-relaxed text-ink-soft">{step.text}</span>
        </span>
      </li>
    {/each}
  </ol>
  <p class="mt-3 px-1 text-[13px] leading-relaxed text-ink-muted">From then on, {from}'s feed only ever offers the bridge, and download links skip it.</p>
  {#if !move.first_release && !move.bridge_release}
    <button type="button" class="button button-sm button-quiet mt-4" disabled={busy} onclick={stay}>Stay with {from}</button>
  {/if}
</section>
