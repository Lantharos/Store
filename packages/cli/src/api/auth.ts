import { spawn } from "node:child_process"
import { type Account, CLI_CLIENT_ID } from "@schelf/protocol"
import { ApiFailure, request } from "@schelf/publisher"
import { blank, done, Failure, line, note, step } from "../ui/output.ts"
import { accent, bold, interactive } from "../ui/style.ts"
import { storedSession, storeSession } from "./credentials.ts"
import { dashboard } from "./dashboard.ts"

interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

interface DeviceToken {
  access_token?: string
  error?: string
}

const GRANT = "urn:ietf:params:oauth:grant-type:device_code"

function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  const child = spawn(command[0]!, command.slice(1), { stdio: "ignore", detached: true })
  child.on("error", () => {})
  child.unref()
}

async function pollForToken(api: string, code: DeviceCode) {
  let interval = code.interval * 1000
  const deadline = Date.now() + code.expires_in * 1000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval))
    const response = await fetch(`${api}/api/auth/device/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: GRANT, device_code: code.device_code, client_id: CLI_CLIENT_ID }),
    })
    const body = (await response.json()) as DeviceToken
    if (body.access_token) return body.access_token
    if (body.error === "slow_down") interval += 5000
    else if (body.error === "access_denied") throw new Failure("Sign-in was declined in the browser")
    else if (body.error !== "authorization_pending")
      throw new Failure(`Sign-in failed: ${body.error ?? response.status}`)
  }
  throw new Failure("The sign-in code expired", "Run the command again for a fresh code.")
}

export async function signIn(api: string) {
  const code = await request<DeviceCode>(`${api}/api/auth/device/code`, {
    method: "POST",
    body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
  })
  const url = code.verification_uri_complete ?? code.verification_uri
  blank()
  line(`Sign in to Schelf in your browser and check the code matches: ${bold(accent(code.user_code))}`)
  note(url)
  if (interactive) openBrowser(url)
  blank()
  const token = await step(
    "Waiting for the browser",
    () => pollForToken(api, code),
    () => "Approved in the browser",
  )
  const account = await dashboard(api, token).account()
  await storeSession(api, token, account.github ?? account.user.email)
  return { token, account }
}

export async function session(api: string): Promise<{ token: string; account: Account }> {
  const stored = await storedSession(api)
  if (stored) {
    try {
      return { token: stored.token, account: await dashboard(api, stored.token).account() }
    } catch (error) {
      if (!(error instanceof ApiFailure && error.status === 401)) throw error
    }
  }
  if (!interactive) throw new Failure("Not signed in", "Run schelf login first.")
  return signIn(api)
}

export function greet(account: Account) {
  done(`Signed in as ${bold(account.github ?? account.user.name)}`)
}
