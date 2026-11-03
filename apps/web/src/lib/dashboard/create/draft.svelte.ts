import {
  type AppSettings,
  createApp,
  createProject,
  type Distribution,
  SCHELF_WORKFLOW,
  type Visibility,
} from "@schelf/protocol"
import { api } from "../api/client.ts"
import { endpoints } from "../api/endpoints.ts"
import { KINDS, type ProjectKind, type Step } from "./kinds.ts"

export type Publishing = "github" | "hand"

interface Fields {
  kind: ProjectKind | null
  step: number
  name: string
  summary: string
  typedSlug: string | null
  id: string
  visibility: Visibility
  distribution: Distribution
  licence: string
  publishing: Publishing
  repository: string
  workflow: string
  environment: string
}

const BLANK: Fields = {
  kind: null,
  step: 0,
  name: "",
  summary: "",
  typedSlug: null,
  id: "",
  visibility: "listed",
  distribution: "open",
  licence: "",
  publishing: "github",
  repository: "",
  workflow: SCHELF_WORKFLOW,
  environment: "",
}

export const slugOf = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)

const compact = (text: string) => text.replace(/[^A-Za-z0-9]+/g, "")

export class Draft {
  fields = $state<Fields>({ ...BLANK })
  readonly #key: string

  constructor(publisherId: string) {
    this.#key = `schelf:new-project:${publisherId}`
    try {
      const saved = localStorage.getItem(this.#key)
      if (saved) this.fields = { ...BLANK, ...(JSON.parse(saved) as Partial<Fields>) }
    } catch {
      localStorage.removeItem(this.#key)
    }
  }

  kind = $derived(this.fields.kind ? KINDS[this.fields.kind] : null)
  steps = $derived<Step[]>(this.kind?.steps ?? ["kind"])
  current = $derived(this.steps[this.fields.step] ?? "kind")
  slug = $derived(this.fields.typedSlug ?? slugOf(this.fields.name))
  started = $derived(this.fields.kind !== null)

  save() {
    localStorage.setItem(this.#key, JSON.stringify(this.fields))
  }

  forget() {
    localStorage.removeItem(this.#key)
  }

  reset() {
    this.forget()
    this.fields = { ...BLANK }
  }

  choose(kind: ProjectKind) {
    if (this.fields.kind !== kind) {
      this.fields.kind = kind
      this.fields.visibility = "listed"
    }
    this.fields.step = 1
  }

  go(step: number) {
    this.fields.step = step
  }

  fillDefaults(github: string | undefined) {
    if (!github) return
    const fields = this.fields
    if (this.current === "id" && !fields.id) fields.id = `io.github.${github}.${compact(fields.name)}`
    if (this.current === "publishing" && !fields.repository)
      fields.repository = `${github}/${compact(fields.name).toLowerCase()}`
  }

  request() {
    const fields = this.fields
    const kind = this.kind!
    const shared = {
      name: fields.name,
      summary: fields.summary,
      distribution: fields.distribution,
      licence: fields.distribution === "open" ? fields.licence.trim() || undefined : undefined,
      ...(fields.publishing === "github"
        ? {
            repository: fields.repository.trim(),
            workflow: fields.workflow.trim(),
            environment: fields.environment.trim() || undefined,
          }
        : {}),
    }
    return kind.store
      ? createApp.safeParse({
          ...shared,
          ...kind.store,
          id: fields.id,
          visibility: kind.steps.includes("visibility") ? fields.visibility : "listed",
        })
      : createProject.safeParse({ ...shared, slug: this.slug, updater: kind.updater })
  }

  async create(publisherId: string) {
    const parsed = this.request()
    if (!parsed.success) throw new Error(parsed.error.issues[0]!.message)
    const path = this.kind!.store ? endpoints.apps(publisherId) : endpoints.projects(publisherId)
    return api.post<AppSettings>(path, parsed.data)
  }
}
