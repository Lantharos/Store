<script lang="ts">
  import Slider from "../../ui/fields/Slider.svelte"
  import Dialog from "../../ui/overlay/Dialog.svelte"

  let {
    open = $bindable(false),
    file,
    onsave,
  }: { open?: boolean; file: File | null; onsave: (logo: File) => Promise<void> } = $props()

  const VIEW = 288
  const OUTPUT = 512
  const FALLBACK_EDGE = 512

  let image = $state<HTMLImageElement | null>(null)
  let zoom = $state(1)
  let x = $state(0)
  let y = $state(0)
  let busy = $state(false)
  let previousScale = 1
  let drag: { pointer: number; startX: number; startY: number; fromX: number; fromY: number } | null = null

  const width = $derived(image ? image.naturalWidth || FALLBACK_EDGE : 0)
  const height = $derived(image ? image.naturalHeight || FALLBACK_EDGE : 0)
  const scale = $derived(image ? (VIEW / Math.min(width, height)) * zoom : 1)

  const clamp = (value: number, size: number) => Math.min(0, Math.max(VIEW - size * scale, value))

  $effect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => {
      image = next
      zoom = 1
      const fit = VIEW / Math.min(next.naturalWidth || FALLBACK_EDGE, next.naturalHeight || FALLBACK_EDGE)
      previousScale = fit
      x = (VIEW - (next.naturalWidth || FALLBACK_EDGE) * fit) / 2
      y = (VIEW - (next.naturalHeight || FALLBACK_EDGE) * fit) / 2
    }
    next.src = url
    return () => URL.revokeObjectURL(url)
  })

  $effect(() => {
    const ratio = scale / previousScale
    previousScale = scale
    x = clamp(VIEW / 2 - (VIEW / 2 - x) * ratio, width)
    y = clamp(VIEW / 2 - (VIEW / 2 - y) * ratio, height)
  })

  function down(event: PointerEvent) {
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: x, fromY: y }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent) {
    if (drag?.pointer !== event.pointerId) return
    x = clamp(drag.fromX + event.clientX - drag.startX, width)
    y = clamp(drag.fromY + event.clientY - drag.startY, height)
  }

  function nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? 24 : 6
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const delta = moves[event.key]
    if (!delta) return
    event.preventDefault()
    x = clamp(x + delta[0], width)
    y = clamp(y + delta[1], height)
  }

  async function save() {
    if (!image) return
    busy = true
    try {
      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const side = VIEW / scale
      canvas.getContext("2d")!.drawImage(image, -x / scale, -y / scale, side, side, 0, 0, OUTPUT, OUTPUT)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("The logo couldn't be drawn"))),
          "image/webp",
          0.92,
        ),
      )
      await onsave(new File([blob], "logo", { type: blob.type }))
      open = false
    } finally {
      busy = false
    }
  }
</script>

<Dialog bind:open class="max-w-[22rem]">
  <div class="p-6">
    <h2 class="text-xl font-semibold">Position your logo</h2>
    <p class="mt-1 text-[15px] text-ink-muted">Drag to move it, and zoom to fit.</p>
    <div
      role="slider"
      tabindex="0"
      aria-label="Logo position"
      aria-valuenow={Math.round(-x)}
      class="relative mt-5 cursor-grab touch-none overflow-hidden rounded-[28%] bg-well select-none focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
      style:width="{VIEW}px"
      style:height="{VIEW}px"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={() => (drag = null)}
      onpointercancel={() => (drag = null)}
      onkeydown={nudge}
    >
      {#if image}
        <img
          src={image.src}
          alt=""
          draggable="false"
          class="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
          style:width="{width}px"
          style:height="{height}px"
          style:transform="translate({x}px, {y}px) scale({scale})"
        />
      {/if}
    </div>
    <div class="mt-5"><Slider bind:value={zoom} min={1} max={4} step={0.01} label="Zoom" format={(value) => `${value.toFixed(1)}×`} /></div>
    <div class="mt-6 flex justify-end gap-2">
      <button type="button" class="button button-quiet" onclick={() => (open = false)}>Cancel</button>
      <button type="button" class="button button-primary" disabled={!image || busy} onclick={save}>Use this logo</button>
    </div>
  </div>
</Dialog>
