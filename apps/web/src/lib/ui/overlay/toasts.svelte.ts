interface ToastAction {
  label: string
  run: () => unknown
}

interface Toast {
  id: number
  text: string
  tone: "neutral" | "danger"
  action?: ToastAction
}

let next = 0

class Toasts {
  list = $state<Toast[]>([])

  show(text: string, tone: Toast["tone"] = "neutral", action?: ToastAction) {
    const toast = { id: next++, text, tone, action }
    this.list.push(toast)
    setTimeout(() => this.dismiss(toast.id), tone === "danger" || action ? 6_000 : 3_500)
  }

  error(error: unknown) {
    this.show(error instanceof Error ? error.message : String(error), "danger")
  }

  dismiss(id: number) {
    this.list = this.list.filter((toast) => toast.id !== id)
  }
}

export const toasts = new Toasts()
