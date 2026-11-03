<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import type { ReleaseDetail } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { bytes } from "../../format.ts"
  import Permissions from "../../store/page/Permissions.svelte"
  import { PLATFORM_NAMES } from "../../system/artifacts.ts"

  let { release }: { release: ReleaseDetail } = $props()
</script>

<div class="space-y-6">
  {#if release.notes}
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">Release notes</h2>
      <p class="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{release.notes}</p>
    </section>
  {/if}

  <section class="rounded-group bg-raised p-5 sm:p-6">
    <h2 class="font-semibold">Files</h2>
    <ul class="mt-3 divide-y divide-hairline">
      {#each release.artifacts as file (file.name)}
        <li class="py-3 text-[15px]">
          <p class="flex items-center justify-between gap-3">
            <span>{PLATFORM_NAMES[file.platform]}</span>
            <span class="text-[13px] text-ink-muted tabular">{bytes(file.size)}</span>
          </p>
          <p class="mt-0.5 truncate font-mono text-[12px] text-ink-muted" title={file.name}>{file.name}</p>
          <div class="mt-2 flex items-center gap-2">
            {#if file.attested}
              <span class="flex items-center gap-1 text-[13px] text-ink-soft"><BadgeCheck class="size-3.5 text-accent" />Build attested</span>
            {/if}
            <CopyButton text={file.sha256} label="SHA-256" class="ml-auto" />
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="rounded-group bg-raised p-5 sm:p-6">
    <Permissions permissions={release.permissions} />
    {#if release.permissions_widened}
      <p class="mt-3 text-[13px] leading-relaxed text-caution">Wider than the last release. People will be asked before they update.</p>
    {/if}
  </section>
</div>
