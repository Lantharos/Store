<script lang="ts">
  import GripVertical from "@lucide/svelte/icons/grip-vertical"
  import ImagePlus from "@lucide/svelte/icons/image-plus"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import Trash2 from "@lucide/svelte/icons/trash-2"
  import { type DashboardScreenshot, MAX_SCREENSHOT_BYTES, MEDIA_TYPES } from "@schelf/protocol"
  import { flip } from "svelte/animate"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { appId, screenshots = $bindable() }: { appId: string; screenshots: DashboardScreenshot[] } = $props()

  interface Pending {
    id: string
    name: string
  }

  let pending = $state<Pending[]>([])
  let dragging = $state<string | null>(null)
  let over = $state(false)
  let picker = $state<HTMLInputElement>()
  let list = $state<HTMLElement>()
  let before: string[] = []
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  async function saveOrder(previous: string[]) {
    const ids = screenshots.map((shot) => shot.id)
    if (ids.join() === previous.join()) return
    try {
      await api.put(endpoints.screenshotOrder(appId), { ids })
    } catch (error) {
      screenshots = previous.map((id) => screenshots.find((shot) => shot.id === id)!)
      toasts.error(error)
    }
  }

  function move(from: number, to: number) {
    const next = [...screenshots]
    const [shot] = next.splice(from, 1)
    next.splice(to, 0, shot!)
    screenshots = next
  }

  function start(event: PointerEvent, id: string) {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragging = id
    before = screenshots.map((shot) => shot.id)
  }

  function drag(event: PointerEvent) {
    if (!dragging || !list) return
    const tiles = [...list.querySelectorAll<HTMLElement>("[data-shot]")]
    const target = tiles.find((tile) => {
      const rect = tile.getBoundingClientRect()
      return (
        event.clientX > rect.left &&
        event.clientX < rect.right &&
        event.clientY > rect.top &&
        event.clientY < rect.bottom
      )
    })
    const to = target ? screenshots.findIndex((shot) => shot.id === target.dataset.shot) : -1
    const from = screenshots.findIndex((shot) => shot.id === dragging)
    if (to >= 0 && to !== from) move(from, to)
  }

  function drop() {
    if (!dragging) return
    dragging = null
    void saveOrder(before)
  }

  function keyboard(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0
    const to = index + step
    if (!step || to < 0 || to >= screenshots.length) return
    event.preventDefault()
    const previous = screenshots.map((shot) => shot.id)
    move(index, to)
    void saveOrder(previous)
    requestAnimationFrame(() =>
      list?.querySelector<HTMLElement>(`[data-shot="${screenshots[to]!.id}"] [data-handle]`)?.focus(),
    )
  }

  async function dimensions(file: File) {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  }

  async function upload(file: File) {
    if (!(MEDIA_TYPES as readonly string[]).includes(file.type) || file.type === "image/svg+xml") {
      toasts.show(`${file.name} isn't a PNG, JPEG or WebP image`, "danger")
      return
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toasts.show(`${file.name} is over 8 MB`, "danger")
      return
    }
    const entry = { id: crypto.randomUUID(), name: file.name }
    pending.push(entry)
    try {
      const { width, height } = await dimensions(file)
      const shot = await api.upload<DashboardScreenshot>(
        `${endpoints.screenshots(appId)}?width=${width}&height=${height}`,
        file,
      )
      screenshots = [...screenshots, shot]
    } catch (error) {
      toasts.error(error)
    } finally {
      pending = pending.filter((item) => item.id !== entry.id)
    }
  }

  function add(files: FileList | null | undefined) {
    for (const file of files ?? []) void upload(file)
  }

  async function remove(shot: DashboardScreenshot) {
    const previous = screenshots
    screenshots = screenshots.filter((item) => item.id !== shot.id)
    try {
      await api.delete(endpoints.screenshot(appId, shot.id))
      toasts.show("Screenshot removed")
    } catch (error) {
      screenshots = previous
      toasts.error(error)
    }
  }
</script>

<div
  role="group"
  aria-label="Screenshots"
  ondragover={(event) => {
    event.preventDefault()
    over = true
  }}
  ondragleave={() => (over = false)}
  ondrop={(event) => {
    event.preventDefault()
    over = false
    add(event.dataTransfer?.files)
  }}
  class="rounded-2xl transition-shadow {over ? 'shadow-[0_0_0_2px_var(--accent)]' : ''}"
>
  <ul bind:this={list} class="grid grid-cols-2 gap-3 sm:grid-cols-3" onpointermove={drag} onpointerup={drop} onpointercancel={drop}>
    {#each screenshots as shot, index (shot.id)}
      <li
        data-shot={shot.id}
        animate:flip={{ duration: still ? 0 : 260 }}
        class="group relative overflow-hidden rounded-xl bg-well transition-[box-shadow,scale] {dragging === shot.id ? 'z-10 scale-[1.03] shadow-float' : ''}"
      >
        <img src={shot.url} alt={shot.caption ?? `Screenshot ${index + 1}`} class="pointer-events-none aspect-[16/10] w-full object-cover" draggable="false" />
        <div class="absolute inset-x-0 top-0 flex items-start justify-between p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            data-handle
            aria-label="Move screenshot {index + 1}. Use the arrow keys."
            onpointerdown={(event) => start(event, shot.id)}
            onkeydown={(event) => keyboard(event, index)}
            class="grid size-8 cursor-grab touch-none place-items-center rounded-lg bg-raised/90 backdrop-blur active:cursor-grabbing"
          >
            <GripVertical class="size-4" />
          </button>
          <button type="button" aria-label="Remove screenshot {index + 1}" onclick={() => remove(shot)} class="grid size-8 place-items-center rounded-lg bg-raised/90 text-danger backdrop-blur">
            <Trash2 class="size-4" />
          </button>
        </div>
        {#if index === 0}<span class="absolute bottom-1.5 left-1.5 rounded-md bg-raised/90 px-1.5 py-0.5 text-[12px] backdrop-blur">Shown first</span>{/if}
      </li>
    {/each}
    {#each pending as item (item.id)}
      <li class="grid aspect-[16/10] place-items-center rounded-xl bg-well text-[13px] text-ink-muted">
        <span class="flex items-center gap-2"><LoaderCircle class="size-4 animate-spin" />Uploading</span>
      </li>
    {/each}
    <li>
      <button
        type="button"
        onclick={() => picker?.click()}
        class="grid aspect-[16/10] w-full place-items-center rounded-xl border border-dashed border-[color-mix(in_oklab,var(--ink)_20%,transparent)] text-[13px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
      >
        <span class="flex flex-col items-center gap-1.5"><ImagePlus class="size-5" />Add screenshots</span>
      </button>
    </li>
  </ul>
  <input bind:this={picker} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onchange={(event) => add(event.currentTarget.files)} />
  <p class="mt-2 text-[13px] text-ink-muted">Drag to reorder, or drop images here. PNG, JPEG or WebP, up to 8 MB. Two or more look best.</p>
</div>
