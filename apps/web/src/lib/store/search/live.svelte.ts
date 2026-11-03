import { API_BASE, type SearchHit, type SearchResponse } from "@schelf/protocol"

const DELAY = 90

export class LiveSearch {
  query = $state("")
  results = $state<SearchHit[]>([])
  loading = $state(false)
  #controller: AbortController | null = null
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly platform: () => string | null) {}

  update(query: string) {
    this.query = query
    clearTimeout(this.#timer)
    this.#controller?.abort()
    if (!query.trim()) {
      this.results = []
      this.loading = false
      return
    }
    this.loading = true
    this.#timer = setTimeout(() => this.#run(query.trim()), DELAY)
  }

  async #run(query: string) {
    const controller = new AbortController()
    this.#controller = controller
    const params = new URLSearchParams({ q: query, limit: "7" })
    const platform = this.platform()
    if (platform) params.set("platform", platform)
    try {
      const response = await fetch(`${API_BASE}/search?${params}`, { signal: controller.signal })
      const body: SearchResponse = await response.json()
      this.results = body.results
    } catch (error) {
      if (controller.signal.aborted) return
      throw error
    } finally {
      if (this.#controller === controller) this.loading = false
    }
  }
}
