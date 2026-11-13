<script lang="ts">
  import type { ReleaseDetail } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { KIND_NAMES, PLATFORM_NAMES } from "../../system/artifacts.ts"
  import Disclosure from "../../ui/group/Disclosure.svelte"

  let { latest, release }: { latest: string; release: ReleaseDetail } = $props()
  const json = $derived(latest.replace(/\/latest$/, "/latest.json"))
  const rows = $derived(
    release.artifacts.map((file) => {
      const twins = release.artifacts.filter(
        (other) => other.part === file.part && other.platform === file.platform,
      ).length
      return {
        key: file.name,
        title: `${file.part ? `${file.part} for ` : ""}${PLATFORM_NAMES[file.platform]}`,
        detail: KIND_NAMES[file.kind],
        url: `${latest}/${file.part ? `${file.part}/` : ""}${file.platform}${twins > 1 ? `/${file.kind}` : ""}`,
      }
    }),
  )
</script>

<Disclosure title="Links for each system" description="For a page with its own button per system. Each one follows new releases too.">
  <ul class="divide-y divide-hairline">
    {#each rows as row (row.key)}
      <li class="flex items-center gap-4 px-5 py-3">
        <span class="min-w-0 flex-1">
          <span class="block text-[15px]">{row.title}<span class="text-ink-muted">{" · "}{row.detail}</span></span>
          <span class="block truncate font-mono text-[12px] text-ink-muted">{row.url.replace(/^https?:\/\//, "")}</span>
        </span>
        <CopyButton text={row.url} label="Copy link for {row.title}, {row.detail}" compact />
      </li>
    {/each}
    <li class="flex items-center gap-4 px-5 py-3">
      <span class="min-w-0 flex-1">
        <span class="block text-[15px]">Every file, as JSON</span>
        <span class="block truncate font-mono text-[12px] text-ink-muted">{json.replace(/^https?:\/\//, "")}</span>
      </span>
      <CopyButton text={json} label="Copy JSON link" compact />
    </li>
  </ul>
</Disclosure>
