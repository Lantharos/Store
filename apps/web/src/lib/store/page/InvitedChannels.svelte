<script lang="ts">
  import { API_BASE, type InvitedDownloads, type ProjectSummary } from "@schelf/protocol"
  import { onMount } from "svelte"
  import { bytes } from "../../format.ts"
  import { groupByPlatform, KIND_NAMES } from "../../system/artifacts.ts"

  let { project }: { project: ProjectSummary } = $props()
  let channels = $state<InvitedDownloads[]>([])

  onMount(async () => {
    const response = await fetch(`${API_BASE}/invited/projects/${project.publisher}/${project.slug}`)
    if (response.ok) channels = await response.json()
  })
</script>

{#each channels as channel (channel.channel)}
  <section class="mt-8 rounded-tile bg-well p-5 sm:p-7" aria-label="{channel.channel} channel">
    <h2 class="font-semibold">{channel.channel} <span class="font-normal text-ink-muted">{channel.version}</span></h2>
    <p class="mt-0.5 text-[13px] text-ink-muted">You're invited to this channel. These links work for an hour.</p>
    <div class="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each groupByPlatform(channel.files) as group (group.key)}
        <div>
          <p class="font-medium">{group.name}</p>
          <ul class="mt-1.5 space-y-0.5">
            {#each group.files as file (file.url)}
              <li>
                <a href={file.url} download class="flex items-center justify-between gap-3 rounded-lg py-1 text-[15px] text-ink-soft hover:text-ink">
                  {KIND_NAMES[file.kind]}
                  <span class="text-[13px] text-ink-muted tabular">{bytes(file.size)}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </section>
{/each}
