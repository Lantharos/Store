<script lang="ts">
  import type { ReleaseDetail } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import Disclosure from "../../ui/group/Disclosure.svelte"

  let { latest, release }: { latest: string; release: ReleaseDetail } = $props()
  const sums = $derived(`${latest}/SHA256SUMS`)
</script>

<Disclosure title="Checksums" description="SHA-256 of each file in {release.version}, for people who check what they download.">
  <ul class="divide-y divide-hairline">
    {#each release.artifacts as file (file.name)}
      <li class="flex items-center gap-4 px-5 py-3">
        <span class="min-w-0 flex-1">
          <span class="block truncate font-mono text-[13px]">{file.name}</span>
          <span class="block truncate font-mono text-[12px] text-ink-muted">{file.sha256}</span>
        </span>
        <CopyButton text={file.sha256} label="Copy checksum of {file.name}" compact />
      </li>
    {/each}
    <li class="flex items-center gap-4 px-5 py-3">
      <span class="min-w-0 flex-1 text-[15px]">All of them in one file, always for the newest release</span>
      <CopyButton text={sums} label="Copy link" />
    </li>
  </ul>
</Disclosure>
