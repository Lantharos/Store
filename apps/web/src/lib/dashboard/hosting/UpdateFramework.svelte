<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import type { AppSettings, Updater } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { bridgeAdvice, FRAMEWORKS, frameworkName } from "./framework.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const move = $derived(settings.switches.find((entry) => !entry.completed_at))
  const finished = $derived(settings.switches.filter((entry) => entry.completed_at))
  let choosing = $state(false)
  let target = $state<Updater | null>(null)
  let busy = $state(false)

  async function run(work: () => Promise<AppSettings>) {
    busy = true
    try {
      settings = await work()
      choosing = false
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }

  const start = () => run(() => api.post<AppSettings>(endpoints.switchUpdater(app.id), { to: target }))
  const cancel = () => run(() => api.delete<AppSettings>(endpoints.switchUpdater(app.id)))
</script>

<section>
  <div class="mb-2.5 flex items-end justify-between gap-4 px-1">
    <div>
      <h2 class="font-semibold">How it updates</h2>
      <p class="mt-0.5 text-[13px] text-ink-muted">{frameworkName(app.updater)}</p>
    </div>
    {#if !move && session.can("apps") && app.kind !== "extension"}
      <button type="button" class="button button-sm button-quiet" onclick={() => ((target = null), (choosing = true))}>Change how this app updates</button>
    {/if}
  </div>

  {#if move}
    <div class="rounded-group bg-raised p-5 sm:p-6">
      <p class="font-medium">Moving from {frameworkName(move.from)} to {frameworkName(move.to)}</p>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-soft">
        Copies already out there only listen to {frameworkName(move.from)}. Ship these two, in either order, and nobody is left behind.
      </p>
      <ol class="mt-5 space-y-4 text-[15px]">
        {#each [
          { done: move.first_release, title: `The first release built with ${frameworkName(move.to)}`, text: "Publish it as usual. New downloads get it straight away." },
          { done: move.bridge_release, title: `A bridge built with ${frameworkName(move.from)}`, text: `One last release the old way, sent with bridge: true in the action or schelf publish --bridge. Its only job is to install the new build and hand over. ${bridgeAdvice(move.from)}` },
        ] as step, index (step.title)}
          <li class="flex gap-3">
            <span class="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular {step.done ? 'bg-accent text-accent-ink' : 'bg-well'}">
              {#if step.done}<Check class="size-4" strokeWidth={2.5} />{:else}{index + 1}{/if}
            </span>
            <span>
              <span class="block font-medium">{step.title}</span>
              <span class="block leading-relaxed text-ink-soft">{step.text}</span>
            </span>
          </li>
        {/each}
      </ol>
      <p class="mt-5 text-[13px] leading-relaxed text-ink-muted">
        From then on, {frameworkName(move.from)}'s feed only ever offers the bridge, and download links skip it.
      </p>
      {#if !move.first_release && !move.bridge_release}
        <button type="button" class="button button-sm button-quiet mt-4" disabled={busy} onclick={cancel}>Stay with {frameworkName(move.from)}</button>
      {/if}
    </div>
  {/if}

  {#each finished as entry (entry.id)}
    <p class="mt-3 px-1 text-[13px] text-ink-muted">Moved from {frameworkName(entry.from)} to {frameworkName(entry.to)} on {date(entry.completed_at!)}.</p>
  {/each}
</section>

<Dialog bind:open={choosing} class="max-w-lg">
  <div class="p-6 sm:p-7">
    <h2 class="text-xl font-semibold tracking-[-0.01em]">Change how {app.name} updates</h2>
    <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">
      {app.updater
        ? `Pick what the app is built with from now on. The ${frameworkName(app.updater)} feed keeps working for copies already installed.`
        : "Pick the updater your app uses, and Schelf serves its feed."}
    </p>
    <div role="radiogroup" aria-label="Updater" class="mt-5 grid gap-2">
      {#each FRAMEWORKS.filter((framework) => framework.updater !== app.updater) as framework (framework.updater)}
        {@const chosen = target === framework.updater}
        <button
          type="button"
          role="radio"
          aria-checked={chosen}
          onclick={() => (target = framework.updater)}
          class="rounded-2xl p-4 text-left transition-[background-color,box-shadow] {chosen ? 'bg-raised shadow-[0_0_0_2px_var(--accent)]' : 'bg-well hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]'}"
        >
          <span class="block font-medium">{framework.title}</span>
          <span class="mt-0.5 block text-[13px] text-ink-muted">{framework.text}</span>
        </button>
      {/each}
    </div>
    {#if target === "sabine"}
      <p class="mt-4 text-[13px] leading-relaxed text-ink-muted">
        In Sabine.toml, use the app id <span class="font-mono">{app.id}</span> and set provider = "schelf" under [updates].
      </p>
    {/if}
    <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" class="button button-quiet" onclick={() => (choosing = false)}>Cancel</button>
      <button type="button" class="button button-primary" disabled={!target || busy} onclick={start}>Continue</button>
    </div>
  </div>
</Dialog>
