export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start"

const GAP = 6
const MARGIN = 8

export function position(anchor: Element, floating: HTMLElement, placement: Placement) {
  const rect = anchor.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = floating
  const viewport = { width: innerWidth, height: innerHeight }
  let [side, align] = placement.split("-") as ["bottom" | "top" | "right", "start" | "end"]

  if (
    side === "bottom" &&
    rect.bottom + GAP + height > viewport.height - MARGIN &&
    rect.top - GAP - height > MARGIN
  ) {
    side = "top"
  } else if (side === "top" && rect.top - GAP - height < MARGIN) side = "bottom"

  let top: number
  let left: number
  if (side === "right") {
    left = rect.right + GAP
    top = rect.top
    if (left + width > viewport.width - MARGIN) left = rect.left - GAP - width
  } else {
    top = side === "bottom" ? rect.bottom + GAP : rect.top - GAP - height
    left = align === "start" ? rect.left : rect.right - width
  }
  left = Math.min(Math.max(MARGIN, left), viewport.width - width - MARGIN)
  top = Math.min(Math.max(MARGIN, top), viewport.height - height - MARGIN)
  floating.style.translate = `${Math.round(left)}px ${Math.round(top)}px`
}

export function portal(node: HTMLElement) {
  document.body.append(node)
  return () => node.remove()
}
