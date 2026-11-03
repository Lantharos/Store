<script lang="ts">
  import type { AppSettings, ReleaseDetail } from "@schelf/protocol"
  import { goto } from "$app/navigation"
  import Select from "../../ui/fields/Select.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { settings, release }: { settings: AppSettings; release: ReleaseDetail } = $props()
  const choices = $derived(
    [...new Set(["stable", "beta", ...settings.channels.map((channel) => channel.name)])]
      .filter((name) => name !== release.channel)
      .map((name) => ({ value: name, label: name })),
  )
  let channel = $state<string>()
  let busy = $state(false)

  async function promote() {
    busy = true
    try {
      const promoted = await api.post<{ release: string }>(endpoints.promote(settings.app.id, release.id), {
        channel,
      })
      await goto(`/dashboard/apps/${settings.app.id}/releases/${promoted.release}`)
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }
</script>

<section class="rounded-group bg-raised p-5 sm:p-6">
  <h2 class="font-semibold">Promote</h2>
  <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">Send these same files to another channel, without uploading them again. That channel's review rules apply.</p>
  <div class="mt-4 flex gap-2">
    <div class="min-w-0 flex-1"><Select label="Channel" placeholder="Channel" bind:value={channel} options={choices} /></div>
    <button type="button" class="button button-quiet" disabled={!channel || busy} onclick={promote}>Promote</button>
  </div>
</section>
