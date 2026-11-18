import { api } from "./client.ts"

export class Resource<T> {
  data = $state<T>()
  error = $state<Error>()
  loading = $derived(this.data === undefined && this.error === undefined)
  #request: Promise<void> | null = null

  constructor(readonly path: string) {}

  refresh() {
    this.#request ??= api
      .get<T>(this.path)
      .then((data) => {
        this.data = data
        this.error = undefined
      })
      .catch((error: Error) => {
        this.error = error
      })
      .finally(() => {
        this.#request = null
      })
    return this.#request
  }

  set(data: T) {
    this.data = data
  }
}

const cache = new Map<string, Resource<unknown>>()

export function resource<T>(path: string): Resource<T> {
  let entry = cache.get(path) as Resource<T> | undefined
  if (!entry) {
    entry = new Resource<T>(path)
    cache.set(path, entry as Resource<unknown>)
  }
  void entry.refresh()
  return entry
}

export function cached<T>(path: string) {
  return cache.get(path) as Resource<T> | undefined
}

export function forget(prefix: string) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key)
}
