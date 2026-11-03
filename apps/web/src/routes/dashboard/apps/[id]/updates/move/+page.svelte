<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { type AppSettings, type ReleaseSummary, type Updater } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import { bridgeAdvice, FRAMEWORKS, frameworkName } from "#lib/dashboard/updates/framework.ts"
  import Choice from "#lib/ui/fields/Choice.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"
  import { goto } from "$app/navigation"

  const settings = $derived(appSettings()())
  const app = $derived(settings.data!.app)
  const releases = $derived(resource<ReleaseSummary[]>(endpoints.releases(app.id)))
  const shippedWithCurrent = $derived(
    app.updater !== null &&
      (releases.data ?? []).some(
        (release) =>
          release.updater === app.updater && ["live", "rolling-out", "withdrawn"].includes(release.status),
      ),
  )
  const choices = $derived(FRAMEWORKS.filter((framework) => framework.updater !== app.updater))
  let target = $state<Updater | null>(null)
  let step = $state(0)
  let busy = $state(false)

  async function start() {
    busy = true
    try {
      settings.set(await api.post<AppSettings>(endpoints.switchUpdater(app.id), { to: target }))
      await goto(`/dashboard/apps/${app.id}/updates`)
    } catch (error) {
      toasts.error(error)
      busy = false
    }
  }
</script>

<svelte:head><title>Change how it updates · {app.name} · Schelf for developers</title></svelte:head>

<div class="max-w-2xl pb-16">
  <a href="/dashboard/apps/{app.id}/updates" class="inline-flex items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink"><ArrowLeft class="size-4" />Updates</a>

  {#key step}
    <div class="enter mt-8">
      {#if step === 0}
        <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em]">What will {app.name} be built with?</h1>
        <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {app.updater ? `It updates with ${frameworkName(app.updater)} now.` : "It has no updater now; people download each version themselves."}
        </p>
        <div role="radiogroup" aria-label="Updater" class="mt-8 space-y-3">
          {#each choices as framework (framework.updater)}
            <Choice title={framework.title} text={framework.text} chosen={target === framework.updater} onclick={() => (target = framework.updater)} />
          {/each}
        </div>
        <div class="mt-10 flex gap-2">
          <a href="/dashboard/apps/{app.id}/updates" class="button button-quiet">Cancel</a>
          <button type="button" class="button button-primary" disabled={!target || !releases.data} onclick={() => (step = 1)}>Continue</button>
        </div>
      {:else if target}
        {@const to = frameworkName(target)}
        {#if shippedWithCurrent && app.updater}
          {@const from = frameworkName(app.updater)}
          <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Two releases, and everyone's moved</h1>
          <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">Copies already installed only listen to {from}, so the move takes two releases, in either order.</p>
          <ol class="mt-8 space-y-6 text-[15px]">
            <li class="flex gap-4">
              <span class="grid size-7 shrink-0 place-items-center rounded-full bg-well text-[13px] font-semibold">1</span>
              <span><span class="block font-medium">The first release built with {to}</span><span class="block leading-relaxed text-ink-soft">Publish it as usual. New downloads get it straight away.</span></span>
            </li>
            <li class="flex gap-4">
              <span class="grid size-7 shrink-0 place-items-center rounded-full bg-well text-[13px] font-semibold">2</span>
              <span><span class="block font-medium">A bridge built with {from}</span><span class="block leading-relaxed text-ink-soft">One last release the old way, whose only job is to install the new build. {bridgeAdvice(app.updater)}</span></span>
            </li>
          </ol>
          <p class="mt-6 text-[15px] leading-relaxed text-ink-soft">{from}'s feed keeps working the whole time, and only ever offers the bridge once it's out.</p>
        {:else}
          <h1 class="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Updates with {to} from the next release</h1>
          <p class="mt-2 text-[15px] leading-relaxed text-ink-soft">Nobody has a copy that updates another way yet, so there's nothing to move. Schelf serves {to}'s feed from now on.</p>
        {/if}
        {#if target === "sabine"}
          <p class="mt-6 text-[15px] leading-relaxed text-ink-soft">In Sabine.toml, use the app id <span class="font-mono text-[14px]">{app.id}</span> and set provider = "schelf" under [updates].</p>
        {/if}
        <div class="mt-10 flex gap-2">
          <button type="button" class="button button-quiet" onclick={() => (step = 0)}>Back</button>
          <button type="button" class="button button-primary" disabled={busy} onclick={start}>{shippedWithCurrent ? "Start the move" : `Use ${to}`}</button>
        </div>
      {/if}
    </div>
  {/key}
</div>
