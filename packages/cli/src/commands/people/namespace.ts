import { PROOF_METHODS, type ProofMethod } from "@schelf/protocol"
import { type Args, flag } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, Failure, field, note, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { approve, needs, publisherOf, signedIn, verbs } from "../context.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const namespaces = await context.dashboard.namespaces(owner.id)
  emit(namespaces)
  title(`Namespaces of ${owner.name}`)
  if (!namespaces.length) note("None yet.")
  for (const namespace of namespaces) {
    field(
      namespace.prefix,
      namespace.verified ? `proven ${muted(`by ${namespace.proof}`)}` : "not proven yet",
    )
    if (!namespace.verified && namespace.instructions)
      note(
        `  TXT ${namespace.instructions.dns}, or ${namespace.instructions.well_known} containing ${namespace.token}`,
      )
  }
  blank()
  return EXIT.ok
}

async function claim(args: Args) {
  const prefix = needs(args.positionals[0], "namespace claim <prefix>")
  const context = await signedIn(args)
  return approve(
    context,
    [{ type: "namespace.claim", publisher: publisherOf(context, args).id, prefix }],
    args,
  )
}

async function verify(args: Args) {
  const prefix = needs(args.positionals[0], "namespace verify <prefix> [--method dns|well-known|github]")
  const method = (flag(args, "method") ?? (prefix.startsWith("io.github.") ? "github" : "dns")) as ProofMethod
  if (!PROOF_METHODS.includes(method))
    throw new Failure(`${method} isn't a way to prove it`, `Use ${PROOF_METHODS.join(", ")}.`, EXIT.usage)
  const context = await signedIn(args)
  const namespace = await context.dashboard.verifyNamespace(publisherOf(context, args).id, prefix, method)
  emit(namespace)
  done(`${prefix} is yours`)
  return EXIT.ok
}

async function release(args: Args) {
  const prefix = needs(args.positionals[0], "namespace release <prefix>")
  const context = await signedIn(args)
  return approve(
    context,
    [{ type: "namespace.release", publisher: publisherOf(context, args).id, prefix }],
    args,
  )
}

export const namespace = verbs("namespace", {
  list: { usage: "list", about: "Namespaces and how to prove the open ones", run: list },
  claim: {
    usage: "claim <prefix>",
    about: "Claim one, like com.example (asks you in the browser)",
    run: claim,
  },
  verify: {
    usage: "verify <prefix> [--method <how>]",
    about: "Check its DNS record, file or GitHub account",
    run: verify,
  },
  release: { usage: "release <prefix>", about: "Give one up (asks you in the browser)", run: release },
})
