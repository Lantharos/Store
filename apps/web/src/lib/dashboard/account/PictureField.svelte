<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import type { AvatarSource } from "@schelf/protocol"
  import Segmented from "../../ui/fields/Segmented.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import SquareCropper from "../publishers/SquareCropper.svelte"
  import Avatar from "./Avatar.svelte"

  const account = $derived(session.account!)
  const avatars = $derived(account.avatars)
  let picker = $state<HTMLInputElement>()
  let chosen = $state<File | null>(null)
  let cropping = $state(false)
  let busy = $state(false)
  let using = $state<AvatarSource>("github")

  $effect.pre(() => {
    using = avatars.using
  })

  async function change(request: () => Promise<unknown>, done: string) {
    busy = true
    try {
      await request()
      await session.refreshAccount()
      toasts.show(done)
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }

  function pick(file: File | undefined) {
    if (!file) return
    chosen = file
    cropping = true
    if (picker) picker.value = ""
  }

  const upload = (picture: File) =>
    change(() => api.upload(endpoints.avatar, picture, "PUT"), "Picture updated")
  const choose = (avatar: AvatarSource) =>
    change(
      () => api.patch(endpoints.avatar, { avatar }),
      avatar === "github" ? "Using your GitHub picture" : "Using your own picture",
    )
  const remove = () => change(() => api.delete(endpoints.avatar), "Picture removed")
</script>

<div class="flex items-center gap-5">
  <div class="relative">
    <Avatar src={account.user.image} name={account.user.name} class="size-20 text-2xl" />
    {#if busy}<span class="absolute inset-0 grid place-items-center rounded-full bg-raised/70"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
  </div>
  <div class="min-w-0 flex-1">
    <p class="truncate text-lg font-semibold">{account.user.name}</p>
    <p class="truncate text-[15px] text-ink-muted">{account.user.email}</p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      {#if avatars.github && avatars.upload}
        <Segmented
          bind:value={using}
          size="sm"
          label="Picture"
          options={[
            { value: "github", label: "GitHub" },
            { value: "upload", label: "Your own" },
          ]}
          onchange={choose}
        />
      {/if}
      <button type="button" class="button button-sm button-quiet" disabled={busy} onclick={() => picker?.click()}>
        {avatars.upload ? "Replace picture" : "Upload a picture"}
      </button>
      {#if avatars.upload && !avatars.github}
        <button type="button" class="button button-sm text-ink-muted hover:text-ink" disabled={busy} onclick={remove}>Remove</button>
      {/if}
    </div>
  </div>
  <input bind:this={picker} type="file" accept="image/png,image/jpeg,image/webp" hidden onchange={(event) => pick(event.currentTarget.files?.[0])} />
</div>

<SquareCropper bind:open={cropping} file={chosen} onsave={upload} subject="picture" round />
