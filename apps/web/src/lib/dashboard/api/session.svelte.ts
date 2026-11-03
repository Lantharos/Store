import type { Account, DashboardApp } from "@schelf/protocol"
import { auth } from "./auth.ts"
import { api } from "./client.ts"
import { endpoints } from "./endpoints.ts"

class Session {
  loaded = $state(false)
  signedIn = $state(false)
  account = $state<Account | null>(null)
  apps = $state<DashboardApp[]>([])

  async load() {
    const { data } = await auth.getSession()
    this.signedIn = !!data
    if (data) {
      ;[this.account, this.apps] = await Promise.all([
        api.get<Account>(endpoints.account),
        api.get<DashboardApp[]>(endpoints.apps),
      ])
    }
    this.loaded = true
  }

  async refreshApps() {
    this.apps = await api.get<DashboardApp[]>(endpoints.apps)
  }

  async signOut() {
    await auth.signOut()
    this.signedIn = false
    this.account = null
    this.apps = []
  }
}

export const session = new Session()
