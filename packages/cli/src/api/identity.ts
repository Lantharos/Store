import { githubOidcToken, oidcAvailable } from "@schelf/publisher"
import { type Args, apiOrigin, flag } from "../args.ts"
import { session } from "./auth.ts"

export type Credential = { kind: "workflow" | "token" | "session"; token: string }

export async function credential(args: Args): Promise<Credential> {
  const token = flag(args, "token") ?? process.env.SCHELF_TOKEN
  if (token) return { kind: "token", token }
  if (oidcAvailable()) return { kind: "workflow", token: await githubOidcToken() }
  return { kind: "session", token: (await session(apiOrigin(args))).token }
}
