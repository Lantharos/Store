<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import type { Artifact, ProjectFile } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { bytes } from "../../format.ts"
  import { groupByPlatform, KIND_NAMES } from "../../system/artifacts.ts"

  let {
    artifacts,
    parts,
    open,
    id,
    note,
  }: { artifacts: Artifact[]; parts: ProjectFile[]; open: boolean; id: string; note: string } = $props()
  const groups = $derived([...groupByPlatform(artifacts), ...groupByPlatform(parts)])
</script>

<div {id} class="disclosure grid {open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}" inert={!open}>
  <div class="min-h-0 overflow-hidden">
    <div class="mt-8 grid gap-x-8 gap-y-5 rounded-tile bg-well p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
      {#each groups as group (group.key)}
        <div>
          <p class="font-medium">{group.name}</p>
          <ul class="mt-1.5 space-y-0.5">
            {#each group.files as file (file.url)}
              <li>
                <a href={file.url} download class="group flex items-center justify-between gap-3 rounded-lg py-1 text-[15px] text-ink-soft hover:text-ink">
                  <span class="flex items-center gap-1.5">
                    {KIND_NAMES[file.kind]}
                    <ArrowUpRight class="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span class="text-[13px] text-ink-muted tabular">{bytes(file.size)}</span>
                </a>
                <p class="flex items-center gap-2 text-[12px] text-ink-muted">
                  <span class="min-w-0 truncate font-mono" title="SHA-256 {file.sha256}">{file.sha256.slice(0, 16)}…</span>
                  <CopyButton text={file.sha256} label="Copy the SHA-256" compact class="h-6!" />
                  {#if file.attestation}<a href={file.attestation} class="hover:text-ink" rel="nofollow">Provenance</a>{/if}
                </p>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
      <p class="text-[13px] leading-relaxed text-ink-muted sm:col-span-full">{note}</p>
    </div>
  </div>
</div>

<style>
  .disclosure {
    transition: grid-template-rows var(--spring-smooth-duration) var(--spring-smooth);
  }
</style>
