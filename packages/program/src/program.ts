import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { pipeline } from "node:stream/promises"
import {
  blockFor,
  paths,
  pickFile,
  revocations,
  STABLE,
  STORE_TOOL,
  type ToolFile,
  toolIndex,
  toolReleaseOn,
} from "@schelf/protocol"
import { Offline, readSigned, type Store, storeKeys } from "./signed.ts"

const FRESH_MS = 60 * 60_000
const STATE = "state.json"
const PROGRAM = "schelf"

interface State {
  checked: number
  serial: number
  version: string
}

export interface Place {
  store: Store
  folder: string
  target: string
}

const programIn = (folder: string, version: string) => join(folder, version, PROGRAM)

const present = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  )

async function readState(folder: string): Promise<State | null> {
  return readFile(join(folder, STATE), "utf8").then(
    (text) => JSON.parse(text) as State,
    () => null,
  )
}

function checked(file: ToolFile) {
  const hash = createHash("sha256")
  let size = 0
  return async function* (chunks: AsyncIterable<Uint8Array>) {
    for await (const chunk of chunks) {
      size += chunk.length
      if (size > file.size) throw new Error(`${file.url} is bigger than schelf.store signed for`)
      hash.update(chunk)
      yield chunk
    }
    if (size !== file.size || hash.digest("hex") !== file.sha256)
      throw new Error(`${file.url} isn't the file schelf.store signed for`)
  }
}

async function download(file: ToolFile, destination: string) {
  const response = await fetch(file.url).catch((error: unknown) => {
    throw new Offline(`Couldn't download ${file.url}: ${(error as Error).message}`)
  })
  if (!response.ok || !response.body) throw new Error(`${file.url} answered ${response.status}`)
  await mkdir(dirname(destination), { recursive: true })
  const partial = `${destination}.${process.pid}.partial`
  try {
    await pipeline(response.body, checked(file), createWriteStream(partial, { mode: 0o755 }))
    await rename(partial, destination)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
}

async function keepOnly(folder: string, version: string) {
  const entries = await readdir(folder, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== version)
      .map((entry) => rm(join(folder, entry.name), { recursive: true, force: true })),
  )
}

async function refresh({ store, folder, target }: Place, last: State | null): Promise<State> {
  const keys = await storeKeys(store)
  const [index, revoked] = await Promise.all([
    readSigned(store, keys, paths.tool(STORE_TOOL.publisher, STORE_TOOL.name), toolIndex),
    readSigned(store, keys, paths.revocations, revocations),
  ])
  if (last && index.serial < last.serial)
    throw new Error("schelf.store sent an older list of schelf's versions than it did before")
  const release = toolReleaseOn(index, STABLE)
  if (!release) throw new Error(`schelf isn't published on ${STABLE} yet`)
  const block = blockFor(revoked, index.project.id, release.version)
  if (block?.action === "block")
    throw new Error(`schelf.store pulled schelf ${release.version}: ${block.note ?? block.reason}`)
  const file = pickFile(release.files, target)
  if (!file) throw new Error(`schelf ${release.version} isn't built for ${target} yet`)
  const program = programIn(folder, release.version)
  if (!(await present(program))) {
    await download(file, program)
    await keepOnly(folder, release.version)
  }
  const state = { checked: Date.now(), serial: index.serial, version: release.version }
  await writeFile(join(folder, STATE), JSON.stringify(state))
  return state
}

/** The path of the schelf program for `target`, as schelf.store signed it on stable, kept in `folder`. */
export async function schelfProgram(place: Place) {
  const last = await readState(place.folder)
  const kept = last && programIn(place.folder, last.version)
  const fresh = last !== null && Date.now() - last.checked < FRESH_MS
  if (kept && fresh && (await present(kept))) return kept
  try {
    return programIn(place.folder, (await refresh(place, last)).version)
  } catch (error) {
    if (error instanceof Offline && kept && (await present(kept))) return kept
    throw error
  }
}
