import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const directory = () =>
  process.platform === "win32"
    ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "schelf")
    : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "schelf")

const file = () => join(directory(), "credentials.json")

type Credentials = Record<string, { token: string; login: string }>

async function readAll(): Promise<Credentials> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Credentials
  } catch {
    return {}
  }
}

export async function storedSession(api: string) {
  return (await readAll())[api]
}

export async function storeSession(api: string, token: string, login: string) {
  const all = await readAll()
  all[api] = { token, login }
  await mkdir(directory(), { recursive: true, mode: 0o700 })
  await writeFile(file(), JSON.stringify(all, null, 2), { mode: 0o600 })
}

export async function forgetSession(api: string) {
  const all = await readAll()
  delete all[api]
  if (Object.keys(all).length === 0) await rm(file(), { force: true })
  else await writeFile(file(), JSON.stringify(all, null, 2), { mode: 0o600 })
}
