<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import { MAX_ICON_BYTES } from "@schelf/protocol"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import FilePicker from "../../ui/fields/FilePicker.svelte"
  import { Task } from "../../ui/overlay/task.svelte.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let {
    appId,
    icon = $bindable(),
    name,
    file,
  }: { appId: string; icon: string | null; name: string; file: string | null } = $props()
  const uploading = new Task()

  async function upload(files: File[]) {
    const file = files[0]!
    if (file.size > MAX_ICON_BYTES) {
      toasts.show("Icons can be up to 1 MB", "danger")
      return
    }
    await uploading.run(async () => {
      icon = (await api.upload<{ url: string }>(endpoints.icon(appId), file, "PUT")).url
      toasts.show("Icon updated")
    })
  }
</script>

<div class="flex items-center gap-5">
  <div class="relative">
    <AppIcon src={icon} name={name || "?"} class="size-20 text-2xl" />
    {#if uploading.busy}<span class="absolute inset-0 grid place-items-center rounded-[22%] bg-raised/70"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
  </div>
  {#if file}
    <p class="font-mono text-[12px] text-ink-muted">{file} · icon</p>
  {:else}
    <div>
      <FilePicker class="button button-sm button-quiet" accept="image/svg+xml,image/png" disabled={uploading.busy} onpick={upload}>Replace icon</FilePicker>
      <p class="mt-1.5 text-[13px] text-ink-muted">A square SVG, or a square PNG of at least 512 pixels.</p>
    </div>
  {/if}
</div>
