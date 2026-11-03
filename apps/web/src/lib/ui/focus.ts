export function focusOnMount(node: HTMLElement) {
  queueMicrotask(() => node.focus())
}

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]"

export function trapFocus(event: KeyboardEvent, node: HTMLElement) {
  const focusable = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.tabIndex >= 0 && element.checkVisibility(),
  )
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || !node.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !node.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}
