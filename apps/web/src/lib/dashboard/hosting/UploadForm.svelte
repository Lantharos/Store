<script lang="ts">
  import FileUp from "@lucide/svelte/icons/file-up"
  import X from "@lucide/svelte/icons/x"
  import { type AppSettings, FILE_KINDS, FILE_PLATFORMS, kindsFor, platformsFor } from "@schelf/protocol"
  import { bytes } from "../../format.ts"
  import { KIND_NAMES, PLATFORM_NAMES } from "../../system/artifacts.ts"
  import Field from "../../ui/fields/Field.svelte"
  import Select from "../../ui/fields/Select.svelte"
  import Switch from "../../ui/fields/Switch.svelte"
  import { Upload } from "./upload.svelte.ts"

  let { settings, onsent }: { settings: AppSettings; onsent: (release: string) => void } = $props()

  const upload = new Upload()
  const move = $derived(settings.switches.find((entry) => !entry.completed_at))
  let version = $state("")
  let channel = $state("")
  let notes = $state("")
  let bridge = $state(false)
  let picker = $state<HTMLInputElement>()
  let over = $state(false)

  const format = $derived(bridge && move ? move.from_format : settings.app.format)
  const platforms = $derived(
    (format === "files" ? FILE_PLATFORMS : platformsFor(format)).map((value) => ({
      value,
      label: PLATFORM_NAMES[value],
    })),
  )
  const kinds = $derived(
    (format === "files" ? FILE_KINDS : kindsFor(format)).map((value) => ({
      value,
      label: KIND_NAMES[value],
    })),
  )
  const busy = $derived(
    upload.stage === "hashing" || upload.stage === "uploading" || upload.stage === "checking",
  )
  const progress = $derived(upload.total ? Math.min(1, upload.sent / upload.total) : 0)
  const stageText = $derived(
    {
      ready: "",
      hashing: `Reading the files · ${Math.round(progress * 100)}%`,
      uploading: `Uploading · ${bytes(upload.sent)} of ${bytes(upload.total)}`,
      checking: "Checking the files",
      done: "Sent",
      failed: upload.error ?? "",
    }[upload.stage],
  )

  async function send(event: SubmitEvent) {
    event.preventDefault()
    const release = await upload.send(settings.app.id, {
      version: version.trim(),
      channel: channel.trim() || undefined,
      notes,
      bridge,
    })
    if (release) onsent(release)
  }

  function drop(event: DragEvent) {
    event.preventDefault()
    over = false
    if (event.dataTransfer?.files) void upload.add(event.dataTransfer.files)
  }
</script>

<form class="space-y-6" onsubmit={send}>
  <button
    type="button"
    class="flex w-full flex-col items-center justify-center gap-2 rounded-group p-10 text-center transition-colors {over ? 'bg-[color-mix(in_oklab,var(--accent)_12%,var(--well))]' : 'bg-well hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]'}"
    ondragover={(event) => (event.preventDefault(), (over = true))}
    ondragleave={() => (over = false)}
    ondrop={drop}
    onclick={() => picker?.click()}
    disabled={busy}
  >
    <FileUp class="size-6 text-ink-muted" />
    <span class="font-medium">Drop the release's files here, or choose them</span>
    <span class="text-[13px] text-ink-muted">Installers, archives, programs and APKs. Add a .sig file next to a file to give it its updater signature.</span>
  </button>
  <input bind:this={picker} type="file" multiple hidden onchange={(event) => event.currentTarget.files && upload.add(event.currentTarget.files)} />

  {#each upload.problems as problem (problem)}<p class="text-[15px] text-danger">{problem}</p>{/each}

  {#if upload.files.length}
    <ul class="divide-y divide-hairline overflow-hidden rounded-group bg-raised">
      {#each upload.files as picked (picked.file.name)}
        <li class="space-y-2.5 px-5 py-3.5">
          <div class="flex items-center justify-between gap-3">
            <span class="min-w-0">
              <span class="block truncate font-mono text-[13px]">{picked.file.name}</span>
              <span class="block text-[13px] text-ink-muted">{bytes(picked.file.size)}{picked.signature ? " · signed for updates" : ""}</span>
            </span>
            <button type="button" class="button button-sm button-quiet w-8 shrink-0 px-0" aria-label="Remove {picked.file.name}" disabled={busy} onclick={() => upload.remove(picked)}><X class="size-4" /></button>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <Select label="System for {picked.file.name}" bind:value={picked.platform} options={platforms} />
            <Select label="Kind of {picked.file.name}" bind:value={picked.kind} options={kinds} />
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="grid gap-6 sm:grid-cols-2">
    <Field label="Version">
      <input class="field tabular" bind:value={version} placeholder="1.4.0" required spellcheck="false" />
    </Field>
    <Field label="Channel" note="Optional" hint="Stable unless the version names one, like 1.4.0-beta.2.">
      <input class="field" bind:value={channel} placeholder="stable" spellcheck="false" />
    </Field>
  </div>
  <Field label="Release notes" note="Optional">
    <textarea class="field h-32 resize-none py-3" bind:value={notes}></textarea>
  </Field>
  {#if move}
    <div class="flex items-start justify-between gap-6 rounded-group bg-raised p-5">
      <div>
        <p class="font-medium">This is the bridge</p>
        <p class="text-[13px] leading-relaxed text-ink-muted">The last build made the old way, whose only job is to install the new one.</p>
      </div>
      <Switch label="This is the bridge" bind:checked={bridge} />
    </div>
  {/if}

  <div class="flex flex-wrap items-center gap-4">
    <button class="button button-primary" disabled={busy || !upload.files.length || !version.trim()}>Send for review</button>
    {#if stageText}<p class="text-[15px] {upload.stage === 'failed' ? 'text-danger' : 'text-ink-soft'}" role="status">{stageText}</p>{/if}
  </div>
  {#if busy && upload.stage !== "checking"}
    <div class="h-1.5 overflow-hidden rounded-full bg-well"><div class="h-full rounded-full bg-accent transition-[width]" style:width="{progress * 100}%"></div></div>
  {/if}
</form>
