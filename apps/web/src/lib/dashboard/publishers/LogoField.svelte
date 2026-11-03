<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import type { DashboardPublisher } from "@schelf/protocol"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import LogoCropper from "./LogoCropper.svelte"
  import PublisherMark from "./PublisherMark.svelte"

  let { publisher, editable }: { publisher: DashboardPublisher; editable: boolean } = $props()
  let picker = $state<HTMLInputElement>()
  let chosen = $state<File | null>(null)
  let cropping = $state(false)
  let busy = $state(false)

  function pick(file: File | undefined) {
    if (!file) return
    chosen = file
    cropping = true
    if (picker) picker.value = ""
  }

  async function save(logo: File) {
    busy = true
    try {
      session.updatePublisher(await api.upload<DashboardPublisher>(endpoints.logo(publisher.id), logo, "PUT"))
      toasts.show("Logo updated")
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }
</script>

<div class="flex items-center gap-5">
  <div class="relative">
    <PublisherMark logo={publisher.logo} name={publisher.name} class="size-20 text-2xl" />
    {#if busy}<span class="absolute inset-0 grid place-items-center rounded-[28%] bg-raised/70"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
  </div>
  {#if editable}
    <div>
      <button type="button" class="button button-sm button-quiet" onclick={() => picker?.click()} disabled={busy}>{publisher.logo ? "Replace logo" : "Add a logo"}</button>
      <p class="mt-1.5 text-[13px] text-ink-muted">PNG, JPEG, WebP or SVG. You'll crop it to a square.</p>
    </div>
    <input bind:this={picker} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onchange={(event) => pick(event.currentTarget.files?.[0])} />
  {/if}
</div>

<LogoCropper bind:open={cropping} file={chosen} onsave={save} />
