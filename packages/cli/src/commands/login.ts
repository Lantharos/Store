import { greet, signIn } from "../api/auth.ts"
import { forgetSession, storedSession } from "../api/credentials.ts"
import { type Args, apiOrigin } from "../args.ts"
import { blank, done, note, title } from "../ui/output.ts"

export async function login(args: Args) {
  const api = apiOrigin(args)
  title("Sign in to Schelf")
  const { account } = await signIn(api)
  greet(account)
  if (!account.developer) note("Run schelf init in an app's repository to become a developer and set it up.")
  blank()
  return 0
}

export async function logout(args: Args) {
  const api = apiOrigin(args)
  const stored = await storedSession(api)
  await forgetSession(api)
  blank()
  done(stored ? `Signed out ${stored.login}` : "Nobody was signed in")
  blank()
  return 0
}
