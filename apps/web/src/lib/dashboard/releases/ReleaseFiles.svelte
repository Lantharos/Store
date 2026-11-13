<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import type { ReleaseDetail } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { bytes } from "../../format.ts"
  import Permissions from "../../store/page/Permissions.svelte"
  import { KIND_NAMES, PLATFORM_NAMES } from "../../system/artifacts.ts"
  import ReleaseNotes from "./ReleaseNotes.svelte"

  let { release }: { release: ReleaseDetail } = $props()
</script>

<div class="space-y-6">
  {#if release.notes}
    <ReleaseNotes notes={release.notes} version={release.version} />
  {/if}

  <section class="rounded-group bg-raised p-5 sm:p-6">
    <h2 class="font-semibold">Files</h2>
    <ul class="mt-3 divide-y divide-hairline">
      {#each release.artifacts as file (file.name)}
        <li class="py-3 text-[15px]">
          <p class="flex items-center justify-between gap-3">
            <span>{file.part ? `${file.part} for ` : ""}{PLATFORM_NAMES[file.platform]}<span class="text-ink-muted">{" · "}{KIND_NAMES[file.kind]}</span></span>
            <span class="text-[13px] text-ink-muted tabular">{bytes(file.size)}</span>
          </p>
          <p class="mt-0.5 truncate font-mono text-[12px] text-ink-muted" title={file.name}>{file.name}</p>
          <div class="mt-2 flex items-center gap-2">
            {#if file.attestation}
              <a href={file.attestation} class="flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink"><BadgeCheck class="size-3.5 text-accent" />Build attested</a>
            {/if}
            <CopyButton text={file.sha256} label="SHA-256" class="ml-auto" />
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if release.format !== "files"}
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <Permissions permissions={release.permissions} />
      {#if release.permissions_widened}
        <p class="mt-3 text-[13px] leading-relaxed text-caution">Wider than the last release. People will be asked before they update.</p>
      {/if}
    </section>
  {/if}
</div>
