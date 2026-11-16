import { messageOf, toasts } from "./toasts.svelte.ts"

export async function attempt<T>(work: () => Promise<T>, failed = (error: unknown) => toasts.error(error)) {
  try {
    return await work()
  } catch (error) {
    failed(error)
  }
}

export class Task {
  busy = $state(false)
  error = $state<string | null>(null)
  readonly #inline: boolean

  constructor({ inline = false } = {}) {
    this.#inline = inline
  }

  async run<T>(work: () => Promise<T>) {
    this.busy = true
    this.error = null
    const result = await attempt(work, this.#inline ? (error) => (this.error = messageOf(error)) : undefined)
    this.busy = false
    return result
  }
}
