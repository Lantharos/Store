import { join } from "node:path"
import { manifestName, SCHELF_TOML } from "@schelf/protocol"
import {
  collectArtifacts,
  githubOidcToken,
  hashArtifacts,
  oidcAvailable,
  publishRelease,
  releaseContext,
  releaseVersion,
} from "@schelf/publisher"
import { type Args, apiOrigin, flag } from "../args.ts"
import { git, repositoryRoot } from "../project/git.ts"
import { blank, done, Failure, field, line, step, title } from "../ui/output.ts"
import { bold, link } from "../ui/style.ts"
import { printChecks } from "./status.ts"

async function credential(args: Args) {
  const token = flag(args, "token") ?? process.env.SCHELF_TOKEN
  if (token) return token
  if (oidcAvailable()) return githubOidcToken()
  throw new Failure(
    "Nothing to publish with",
    "In GitHub Actions, give the job id-token: write. Elsewhere, create a token in the dashboard and pass --token or SCHELF_TOKEN.",
  )
}

export async function publish(args: Args) {
  const api = apiOrigin(args)
  const root = await repositoryRoot(process.cwd())
  const context = await releaseContext(flag(args, "config") ?? join(root, SCHELF_TOML))
  const commit = context.commit ?? (await git(root, "rev-parse", "HEAD").catch(() => undefined))
  const channel = flag(args, "channel")
  const version = await releaseVersion({
    version: flag(args, "version"),
    folder: context.folder,
    format: context.manifest.format,
    tag: context.tag,
    commit,
    channel,
  }).catch((error: Error) => {
    throw new Failure("This release has no version", `${error.message}.`)
  })
  if (!args.positionals.length)
    throw new Failure(
      "Name the files to publish",
      "For example: schelf publish dist/*.AppImage, or dist/app.tar.gz#macos-aarch64 to say which system a file is for",
    )

  title(`Publishing ${manifestName(context.manifest)} ${version}`)
  const artifacts = await collectArtifacts(args.positionals, context.manifest.format)
  for (const artifact of artifacts) field(artifact.platform, artifact.name, 18)
  blank()

  const token = await credential(args)
  const result = await step(
    `Uploading ${artifacts.length} file${artifacts.length === 1 ? "" : "s"}`,
    async () =>
      publishRelease({
        api,
        token,
        version,
        channel,
        bridge: args.flags.has("bridge"),
        commit,
        schelfToml: context.schelfToml,
        permissionsToml: context.permissionsToml,
        notes: flag(args, "notes") ?? context.notes,
        artifacts: await hashArtifacts(artifacts),
      }),
  )
  done(
    `${bold(`${result.release.app} ${result.release.version}`)} is ${result.completed.status.replace("-", " ")}`,
  )
  printChecks(result.completed.checks)
  blank()
  line(link(result.completed.dashboard))
  blank()
  return result.completed.checks.some((check) => check.status === "failed") ? 1 : 0
}
