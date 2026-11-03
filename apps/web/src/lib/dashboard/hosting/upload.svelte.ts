import {
  API_BASE,
  type ArtifactKind,
  type CompleteResponse,
  inferFile,
  type ManualUpload,
  type Platform,
  type PublishResponse,
  UPDATER_SIGNATURE,
} from "@schelf/protocol"
import { createSHA256 } from "hash-wasm"
import { api } from "../api/client.ts"
import { endpoints } from "../api/endpoints.ts"

const CONCURRENCY = 3

export interface PickedFile {
  file: File
  platform: Platform
  kind: ArtifactKind
  signature?: string
  sha256?: string
}

export type Stage = "ready" | "hashing" | "uploading" | "checking" | "done" | "failed"

async function sha256(file: File, onProgress: (done: number) => void) {
  const hasher = await createSHA256()
  const reader = file.stream().getReader()
  let done = 0
  for (;;) {
    const { value, done: finished } = await reader.read()
    if (finished) return hasher.digest("hex")
    hasher.update(value)
    done += value.length
    onProgress(done)
  }
}

function put(url: string, token: string, body: Blob, onProgress: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("authorization", `Bearer ${token}`)
    request.upload.onprogress = (event) => onProgress(event.loaded)
    request.onload = () => {
      if (request.status < 300) return resolve()
      const answer = JSON.parse(request.responseText || "{}") as { error?: string }
      reject(new Error(answer.error ?? `The upload stopped with ${request.status}`))
    }
    request.onerror = () => reject(new Error("The connection dropped. Try again."))
    request.send(body)
  })
}

async function inParallel<T>(items: T[], work: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await work(item)
    }),
  )
}

export class Upload {
  files = $state<PickedFile[]>([])
  problems = $state<string[]>([])
  stage = $state<Stage>("ready")
  sent = $state(0)
  error = $state<string | null>(null)
  result = $state<CompleteResponse | null>(null)
  total = $derived(this.files.reduce((sum, picked) => sum + picked.file.size, 0))

  async add(list: Iterable<File>) {
    const incoming = [...list]
    const signatures = new Map<string, string>()
    for (const file of incoming.filter((each) => UPDATER_SIGNATURE.test(each.name)))
      signatures.set(file.name.replace(UPDATER_SIGNATURE, ""), (await file.text()).trim())
    const problems: string[] = []
    for (const file of incoming.filter((each) => !UPDATER_SIGNATURE.test(each.name))) {
      if (this.files.some((picked) => picked.file.name === file.name)) continue
      try {
        this.files.push({ file, ...inferFile(file.name), signature: signatures.get(file.name) })
      } catch (error) {
        problems.push((error as Error).message)
      }
    }
    for (const picked of this.files) picked.signature ??= signatures.get(picked.file.name)
    this.problems = problems
  }

  remove(picked: PickedFile) {
    this.files = this.files.filter((each) => each !== picked)
  }

  async send(appId: string, details: Omit<ManualUpload, "files">) {
    this.error = null
    this.sent = 0
    try {
      this.stage = "hashing"
      let hashed = 0
      for (const picked of this.files) {
        const before = hashed
        picked.sha256 ??= await sha256(picked.file, (done) => (this.sent = before + done))
        hashed += picked.file.size
      }
      this.stage = "uploading"
      this.sent = 0
      const started = await api.post<PublishResponse>(endpoints.uploads(appId), {
        ...details,
        files: this.files.map((picked) => ({
          name: picked.file.name,
          platform: picked.platform,
          kind: picked.kind,
          size: picked.file.size,
          sha256: picked.sha256,
          signature: picked.signature,
        })),
      })
      const byName = new Map(this.files.map((picked) => [picked.file.name, picked.file]))
      const parts = started.files.flatMap((target) =>
        Array.from({ length: target.parts }, (_, index) => ({ target, number: index + 1 })),
      )
      const progress = new Map<string, number>()
      await inParallel(parts, async ({ target, number }) => {
        const file = byName.get(target.name)!
        const url = new URL(target.url, location.origin)
        let body: Blob = file
        if (target.parts > 1) {
          url.searchParams.set("part", String(number))
          url.searchParams.set("parts", String(target.parts))
          body = file.slice((number - 1) * target.part_size, number * target.part_size)
        }
        const key = `${target.name}:${number}`
        await put(url.pathname + url.search, started.upload_token, body, (sent) => {
          progress.set(key, sent)
          this.sent = [...progress.values()].reduce((sum, value) => sum + value, 0)
        })
      })
      this.stage = "checking"
      const response = await fetch(`${API_BASE}/publish/${encodeURIComponent(started.release)}/complete`, {
        method: "POST",
        headers: { authorization: `Bearer ${started.upload_token}` },
      })
      const answer = (await response.json()) as CompleteResponse & { error?: string }
      if (!response.ok) throw new Error(answer.error ?? "Schelf couldn't finish the upload")
      this.result = answer
      this.stage = "done"
      return started.release
    } catch (error) {
      this.error = (error as Error).message
      this.stage = "failed"
      return null
    }
  }
}
