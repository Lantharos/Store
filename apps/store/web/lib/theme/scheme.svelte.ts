import { MediaQuery } from "svelte/reactivity"

export type Scheme = "system" | "light" | "dark"

const KEY = "schelf:scheme"
const prefersDark = new MediaQuery("(prefers-color-scheme: dark)", false)

class SchemePreference {
  value = $state<Scheme>("system")
  shown = $derived<"light" | "dark">(
    this.value === "system" ? (prefersDark.current ? "dark" : "light") : this.value,
  )

  load() {
    this.value = (localStorage.getItem(KEY) as Scheme | null) ?? "system"
  }

  set(next: Scheme) {
    this.value = next
    const root = document.documentElement
    if (next === "system") {
      localStorage.removeItem(KEY)
      delete root.dataset.scheme
    } else {
      localStorage.setItem(KEY, next)
      root.dataset.scheme = next
    }
  }
}

export const scheme = new SchemePreference()
