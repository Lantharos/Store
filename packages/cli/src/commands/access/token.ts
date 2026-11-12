import { askApproval } from "../../api/approvals.ts"
import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, field, line, note, title } from "../../ui/output.ts"
import { bold, muted } from "../../ui/style.ts"
import { appOf, needs, signedIn, verbs } from "../context.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const settings = await context.dashboard.app(await appOf(args))
  emit(settings.tokens)
  title(`Upload tokens of ${settings.app.id}`)
  if (!settings.tokens.length) note("None.")
  for (const token of settings.tokens)
    field(
      token.id,
      `${token.name} ${muted(token.revoked_at ? "revoked" : `expires ${token.expires_at.slice(0, 10)}${token.last_used_at ? `, last used ${token.last_used_at.slice(0, 10)}` : ""}`)}`,
      20,
    )
  blank()
  return EXIT.ok
}

async function create(args: Args) {
  const name = needs(args.positionals[0], "token create <name>")
  const context = await signedIn(args)
  const { code, approval } = await askApproval(
    context.api,
    context.token,
    [{ type: "token.create", app: await appOf(args), name }],
    args,
  )
  const secret = approval.secrets[name]
  if (!secret) return code
  blank()
  line(`${bold(secret)}`)
  note("Shown once. Keep it as SCHELF_TOKEN where you publish from.")
  blank()
  return code
}

async function revoke(args: Args) {
  const token = needs(args.positionals[0], "token revoke <id>")
  const context = await signedIn(args)
  const id = await appOf(args)
  await context.dashboard.revokeToken(id, token)
  emit({ revoked: token })
  done(`Revoked ${token}`)
  return EXIT.ok
}

export const token = verbs("token", {
  list: { usage: "list", about: "Upload tokens for publishing outside GitHub Actions", run: list },
  create: { usage: "create <name>", about: "Make one, shown once (asks you, with a passkey)", run: create },
  revoke: { usage: "revoke <id>", about: "Stop a token working, at once", run: revoke },
})
