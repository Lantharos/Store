<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import { MAX_ICON_BYTES } from "@schelf/protocol"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let {
    appId,
    icon = $bindable(),
    name,
    file,
  }: { appId: string; icon: string | null; name: string; file: string | null } = $props()
  let picker = $state<HTMLInputElement>()
  let busy = $state(false)

  async function upload(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_ICON_BYTES) {
      toasts.show("Icons can be up to 1 MB", "danger")
      return
    }
    busy = true
    try {
      icon = (await api.upload<{ url: string }>(endpoints.icon(appId), file, "PUT")).url
      toasts.show("Icon updated")
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }
</script>

<div class="flex items-center gap-5">
  <div class="relative">
    <AppIcon src={icon} name={name || "?"} class="size-20 text-2xl" />
    {#if busy}<span class="absolute inset-0 grid place-items-center rounded-[22%] bg-raised/70"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
  </div>
  {#if file}
    <p class="font-mono text-[12px] text-ink-muted">{file} · icon</p>
  {:else}
    <div>
      <button type="button" class="button button-sm button-quiet" onclick={() => picker?.click()} disabled={busy}>Replace icon</button>
      <p class="mt-1.5 text-[13px] text-ink-muted">A square SVG, or a square PNG of at least 512 pixels.</p>
    </div>
    <input bind:this={picker} type="file" accept="image/svg+xml,image/png" hidden onchange={(event) => upload(event.currentTarget.files?.[0])} />
  {/if}
</div>
