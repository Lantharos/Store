<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import type { DashboardPublisher } from "@schelf/protocol"
  import FilePicker from "../../ui/fields/FilePicker.svelte"
  import { Task } from "../../ui/overlay/task.svelte.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import PublisherMark from "./PublisherMark.svelte"
  import SquareCropper from "./SquareCropper.svelte"

  let { publisher, editable }: { publisher: DashboardPublisher; editable: boolean } = $props()
  let chosen = $state<File | null>(null)
  let cropping = $state(false)
  const saving = new Task()
  const usesPicture = $derived(publisher.kind === "person" && !publisher.logo)

  function pick(files: File[]) {
    chosen = files[0]!
    cropping = true
  }

  const save = (logo: File) =>
    saving.run(async () => {
      session.updatePublisher(await api.upload<DashboardPublisher>(endpoints.logo(publisher.id), logo, "PUT"))
      toasts.show("Logo updated")
    })
</script>

<div class="flex items-center gap-5">
  <div class="relative">
    <PublisherMark logo={session.logoOf(publisher)} name={publisher.name} person={usesPicture} class="size-20 text-2xl" />
    {#if saving.busy}<span class="absolute inset-0 grid place-items-center bg-raised/70 {usesPicture ? 'rounded-full' : 'rounded-[28%]'}"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
  </div>
  {#if editable}
    <div>
      <FilePicker class="button button-sm button-quiet" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={saving.busy} onpick={pick}>{publisher.logo ? "Replace logo" : "Add a logo"}</FilePicker>
      <p class="mt-1.5 text-[13px] text-ink-muted">{usesPicture ? "Your profile picture shows until you add one." : "PNG, JPEG, WebP or SVG. You'll crop it to a square."}</p>
    </div>
  {/if}
</div>

<SquareCropper bind:open={cropping} file={chosen} onsave={save} />
