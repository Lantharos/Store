import { type Ability, type Account, can, type DashboardApp, type DashboardPublisher } from "@schelf/protocol"
import { auth } from "./auth.ts"
import { api } from "./client.ts"
import { endpoints } from "./endpoints.ts"

const REMEMBERED = "schelf:publisher"

function remembered() {
  try {
    return localStorage.getItem(REMEMBERED)
  } catch {
    return null
  }
}

function remember(id: string) {
  try {
    localStorage.setItem(REMEMBERED, id)
  } catch {}
}

class Session {
  loaded = $state(false)
  signedIn = $state(false)
  account = $state<Account | null>(null)
  #chosen = $state<string | null>(remembered())
  #loaded = $state<{ publisherId: string; apps: DashboardApp[] } | null>(null)

  publisher: DashboardPublisher | null = $derived(
    this.account?.publishers.find((entry) => entry.id === this.#chosen) ??
      this.account?.publishers[0] ??
      null,
  )

  appsLoaded = $derived(this.#loaded !== null && this.#loaded.publisherId === this.publisher?.id)
  apps: DashboardApp[] = $derived(this.appsLoaded ? this.#loaded!.apps : [])

  logoOf(publisher: DashboardPublisher) {
    return publisher.logo ?? (publisher.kind === "person" ? (this.account?.user.image ?? null) : null)
  }

  can(ability: Ability) {
    return this.publisher ? can(this.publisher.role, ability) : false
  }

  async load() {
    const { data } = await auth.getSession()
    this.signedIn = !!data
    if (data) {
      this.account = await api.get<Account>(endpoints.account)
      await this.refreshApps()
    }
    this.loaded = true
  }

  async refreshAccount() {
    this.account = await api.get<Account>(endpoints.account)
  }

  async refreshApps() {
    const publisherId = this.publisher?.id
    if (!publisherId) {
      this.#loaded = null
      return
    }
    const apps = await api.get<DashboardApp[]>(endpoints.apps(publisherId))
    if (publisherId === this.publisher?.id) this.#loaded = { publisherId, apps }
  }

  async use(id: string) {
    if (id === this.publisher?.id || !this.account?.publishers.some((entry) => entry.id === id)) return
    this.#chosen = id
    remember(id)
    await this.refreshApps()
  }

  updatePublisher(next: DashboardPublisher) {
    if (!this.account) return
    this.account.publishers = this.account.publishers.map((entry) => (entry.id === next.id ? next : entry))
  }

  async signOut() {
    await auth.signOut()
    this.signedIn = false
    this.account = null
    this.#loaded = null
  }
}

export const session = new Session()
