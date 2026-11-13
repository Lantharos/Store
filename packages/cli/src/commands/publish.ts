import { join } from "node:path"
import { manifestName, SCHELF_TOML } from "@schelf/protocol"
import {
  applyConfig,
  collectArtifacts,
  configBundle,
  type HashedArtifact,
  hashArtifacts,
  publishRelease,
  releaseContext,
  releaseVersion,
  uploadRelease,
} from "@schelf/publisher"
import { dashboard } from "../api/dashboard.ts"
import { type Credential, credential } from "../api/identity.ts"
import { type Args, apiOrigin, flag } from "../args.ts"
import { git, repositoryRoot } from "../project/git.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, emit, Failure, field, line, step, title } from "../ui/output.ts"
import { bold, link } from "../ui/style.ts"
import { printApplied } from "./apply.ts"
import { printChecks } from "./status.ts"

interface Release {
  config: Awaited<ReturnType<typeof configBundle>>
  version: string
  channel: string | undefined
  notes: string
  artifacts: HashedArtifact[]
}

async function uploadAsPerson(
  api: string,
  signedIn: Credential,
  appId: string,
  release: Release,
  bridge: boolean,
) {
  const applied = await applyConfig(api, signedIn.token, release.config)
  const started = await dashboard(api, signedIn.token).upload(appId, {
    version: release.version,
    channel: release.channel,
    notes: release.notes,
    bridge,
    files: release.artifacts.map((artifact) => ({
      name: artifact.name,
      platform: artifact.platform,
      kind: artifact.kind,
      size: artifact.size,
      sha256: artifact.sha256,
      signature: artifact.signature,
    })),
  })
  return { applied, release: started, completed: await uploadRelease(api, started, release.artifacts) }
}

export async function publish(args: Args) {
  const api = apiOrigin(args)
  const root = await repositoryRoot(process.cwd())
  const config = flag(args, "config") ?? join(root, SCHELF_TOML)
  const context = await releaseContext(config)
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
    throw new Failure("This release has no version", `${error.message}.`, EXIT.usage)
  })
  if (!args.positionals.length)
    throw new Failure(
      "Name the files to publish",
      "For example: schelf publish dist/*.AppImage, or dist/app.tar.gz#macos-aarch64 to say which system a file is for",
      EXIT.usage,
    )

  const id = manifestName(context.manifest)
  title(`Publishing ${id} ${version}`)
  const artifacts = await hashArtifacts(await collectArtifacts(args.positionals, context.manifest))
  for (const artifact of artifacts)
    field([artifact.part, artifact.platform].filter(Boolean).join(" "), artifact.name, 24)
  blank()

  const signed = await credential(args)
  const release: Release = {
    config: await configBundle(root, config),
    version,
    channel,
    notes: flag(args, "notes") ?? context.notes,
    artifacts,
  }
  const bridge = args.flags.has("bridge")
  const result = await step(`Uploading ${artifacts.length} file${artifacts.length === 1 ? "" : "s"}`, () =>
    signed.kind === "session"
      ? uploadAsPerson(api, signed, id, release, bridge)
      : publishRelease({
          api,
          token: signed.token,
          bridge,
          commit,
          schelfToml: context.schelfToml,
          permissionsToml: context.permissionsToml,
          ...release,
        }),
  )
  emit({
    applied: result.applied,
    release: result.release.release,
    status: result.completed.status,
    checks: result.completed.checks,
    url: result.completed.dashboard,
  })
  printApplied(result.applied)
  done(
    `${bold(`${result.release.app} ${result.release.version}`)} is ${result.completed.status.replace("-", " ")}`,
  )
  printChecks(result.completed.checks)
  blank()
  line(link(result.completed.dashboard))
  blank()
  return result.completed.checks.some((check) => check.status === "failed") ? EXIT.failed : EXIT.ok
}
