<script lang="ts">
  import { luftVersionLabel, type ReleaseDetail, type ShellStatus } from "@schelf/protocol"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"

  let {
    appId,
    release,
    shell,
    onchange,
  }: {
    appId: string
    release: ReleaseDetail
    shell: ShellStatus
    onchange: (release: ReleaseDetail) => void
  } = $props()

  let busy = $state(false)

  async function ask() {
    busy = true
    try {
      onchange(await api.post<ReleaseDetail>(endpoints.insideLuft(appId, release.id)))
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }
</script>

<section class="rounded-group bg-raised p-5 sm:p-6">
  <h2 class="font-semibold">Inside Luft</h2>
  {#if release.luft}
    <p class="mt-1 text-[15px] text-ink-muted">Needs {luftVersionLabel(release.luft)} or newer.</p>
  {/if}
  <div class="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
    {#if shell.runs_in_shell}
      <p>Luft reviewed these files, so this release runs inside Luft's desktop. Each new release is reviewed again.</p>
    {:else if shell.review === "approved"}
      <p>Luft approved these files, but they run on their own until your publisher is verified again.</p>
    {:else if shell.review === "waiting"}
      <p>Waiting for Luft's review. You'll get an email when it's decided.</p>
    {:else if shell.review === "refused"}
      <p>Luft decided this release can't run inside the desktop:</p>
      {#if shell.reason}<p class="text-ink">{shell.reason}</p>{/if}
      <p>It stays on Schelf. Publish a new release with the change, then ask again.</p>
    {:else if !shell.verified}
      <p>Extensions run on their own unless Luft reviews them to run inside its desktop, which only extensions from a verified publisher can. <a href="/dashboard/settings/verification" class="link">Verify your publisher</a></p>
    {:else}
      <p>Extensions run on their own unless Luft reviews them to run inside its desktop, drawing in the same scene as everything else.</p>
      {#if shell.requestable && session.can("releases")}
        <button type="button" class="button button-quiet" disabled={busy} onclick={ask}>Ask to run inside Luft</button>
      {:else if !shell.requestable}
        <p class="text-ink-muted">You can ask once the release passes its checks.</p>
      {/if}
    {/if}
  </div>
</section>
