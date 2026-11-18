<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import type { AvatarSource } from "@schelf/protocol"
  import FilePicker from "../../ui/fields/FilePicker.svelte"
  import Segmented from "../../ui/fields/Segmented.svelte"
  import { Task } from "../../ui/overlay/task.svelte.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import SquareCropper from "../publishers/SquareCropper.svelte"
  import Avatar from "./Avatar.svelte"

  const account = $derived(session.account!)
  const avatars = $derived(account.avatars)
  let chosen = $state<File | null>(null)
  let cropping = $state(false)
  const changing = new Task()
  let using = $derived<AvatarSource>(avatars.using)

  const change = (request: () => Promise<unknown>, done: string) =>
    changing.run(async () => {
      await request()
      await session.refreshAccount()
      toasts.show(done)
    })

  function pick(files: File[]) {
    chosen = files[0]!
    cropping = true
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
    {#if changing.busy}<span class="absolute inset-0 grid place-items-center rounded-full bg-raised/70"><LoaderCircle class="size-5 animate-spin" /></span>{/if}
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
      <FilePicker class="button button-sm button-quiet" accept="image/png,image/jpeg,image/webp" disabled={changing.busy} onpick={pick}>
        {avatars.upload ? "Replace picture" : "Upload a picture"}
      </FilePicker>
      {#if avatars.upload && !avatars.github}
        <button type="button" class="button button-sm text-ink-muted hover:text-ink" disabled={changing.busy} onclick={remove}>Remove</button>
      {/if}
    </div>
  </div>
</div>

<SquareCropper bind:open={cropping} file={chosen} onsave={upload} subject="picture" round />
