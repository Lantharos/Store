import { stringify } from "smol-toml"
import { EXTENSION_MANIFEST } from "./extensions.ts"
import type { Format, Kind } from "./platforms.ts"

export const SCHELF_WORKFLOW = ".github/workflows/schelf.yml"
export const SABINE_REPOSITORY = "Lantharos/Sabine"
export const PUBLISH_ACTION = "Lantharos/Store/publish@v1"
export const SCHELF_SABINE_VERSION = "v0.70"

export interface SetupInput {
  id: string
  project?: string
  kind: Kind
  format: Format
  permissions?: string
  listing?: string
  sabineVersion?: string
  sabineInputs?: Record<string, string>
  extensionApi?: number
  helper?: { path: string; build: string }
  environment?: string | null
  branch?: string
}

export function schelfTomlFor(input: SetupInput) {
  const sabine = sabineVersionOf(input)
  const permissions = input.permissions ?? (input.kind === "extension" ? EXTENSION_MANIFEST : undefined)
  const requires = {
    ...(sabine && { sabine: sabine.replace(/^v/, "") }),
    ...(input.extensionApi !== undefined && { extension_api: input.extensionApi }),
  }
  return stringify({
    ...(input.project ? { project: input.project } : { id: input.id }),
    kind: input.kind,
    format: input.format,
    ...(permissions && { permissions }),
    ...(input.listing && { listing: input.listing }),
    ...(Object.keys(requires).length > 0 && { requires }),
  })
}

const RELEASE_TRIGGER = `on:
  release:
    types: [published]
`

const VERSION_FILES: Partial<Record<Format, string>> = {
  sabine: "Sabine.toml",
  "luft-extension": EXTENSION_MANIFEST,
}

function dispatchTrigger(input: SetupInput) {
  const push = input.branch
    ? `  push:
    branches: [${input.branch}]
    paths: [${VERSION_FILES[input.format]}]
`
    : ""
  return `on:
  workflow_dispatch:
    inputs:
      channel:
        description: Channel
        type: choice
        options: [stable, beta, nightly]
        default: stable
${push}`
}

const header = (trigger: string, permissions: string[]) => `name: Publish to Schelf

${trigger}
permissions:
${permissions.map((permission) => `  ${permission}`).join("\n")}

jobs:
`

const PUBLISH_PERMISSIONS = ["contents: read", "id-token: write", "attestations: write"]

const versionJob = (manifest: string) => `  version:
    runs-on: ubuntu-latest
    outputs:
      changed: \${{ github.event_name == 'workflow_dispatch' || steps.compare.outputs.changed == 'true' }}
    steps:
      - uses: actions/checkout@v7
      - id: compare
        if: github.event_name == 'push'
        name: Check whether the version changed
        run: |
          git fetch --quiet --depth=1 origin "\${{ github.event.before }}"
          if git diff "\${{ github.event.before }}" HEAD -- ${manifest} | grep -q '^+version'; then echo changed=true >> "$GITHUB_OUTPUT"; fi
`

const CHANNEL_INPUT = `          channel: \${{ inputs.channel }}\n`

const versionGate = (input: SetupInput) =>
  input.branch
    ? {
        jobs: versionJob(VERSION_FILES[input.format]!),
        gate: "    needs: version\n    if: needs.version.outputs.changed == 'true'\n",
      }
    : { jobs: "", gate: "" }

const publishJob = (environment: string | null | undefined) =>
  `  publish:\n    runs-on: ubuntu-latest\n${environment ? `    environment: ${environment}\n` : ""}`

const sabineInputs = (input: SetupInput) =>
  Object.entries(input.sabineInputs ?? {})
    .map(([name, value]) => `      ${name}: ${value}\n`)
    .join("")

function sabineWorkflow(input: SetupInput) {
  const version = sabineVersionOf(input)!
  const { jobs, gate } = versionGate(input)
  return `${header(dispatchTrigger(input), ["contents: write", ...PUBLISH_PERMISSIONS.slice(1)])}${jobs}  build:
${gate}    uses: ${SABINE_REPOSITORY}/.github/workflows/release-app.yml@${version}
    with:
      sabine_version: ${version}
${sabineInputs(input)}      # Building the MSI package accepts the WiX 7 licence: https://docs.firegiant.com/wix/osmf/
      accept_wix_eula: true
    secrets: inherit
${publishJob(input.environment)}    needs: build
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          pattern: release-*
          path: dist
          merge-multiple: true
      - uses: ${PUBLISH_ACTION}
        with:
          files: dist/**
${CHANNEL_INPUT}`
}

function appImageWorkflow(environment: string | null | undefined) {
  return `${header(RELEASE_TRIGGER, PUBLISH_PERMISSIONS)}${publishJob(environment)}    steps:
      - uses: actions/checkout@v7
      - uses: ${PUBLISH_ACTION}
        with:
          release-assets: "*.AppImage"
`
}

function extensionWithHelperWorkflow(input: SetupInput, helper: { path: string; build: string }) {
  const { jobs, gate } = versionGate(input)
  return `${header(dispatchTrigger(input), PUBLISH_PERMISSIONS)}${jobs}  build:
${gate}    strategy:
      matrix:
        runner: [ubuntu-24.04, ubuntu-24.04-arm]
    runs-on: \${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v7
      - name: Build the helper
        run: ${helper.build}
      - name: Pack the extension with its helper
        run: |
          mkdir -p dist
          git archive --format=tar --output=extension.tar HEAD
          tar --append --file=extension.tar ${helper.path}
          zstd -19 extension.tar -o "dist/${input.id}-$(uname -m).tar.zst"
      - uses: actions/upload-artifact@v7
        with:
          name: extension-\${{ matrix.runner }}
          path: dist
${publishJob(input.environment)}    needs: build
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          pattern: extension-*
          path: dist
          merge-multiple: true
      - uses: ${PUBLISH_ACTION}
        with:
          files: dist/*.tar.zst
${CHANNEL_INPUT}`
}

function extensionWorkflow(input: SetupInput) {
  const { jobs, gate } = versionGate(input)
  return `${header(dispatchTrigger(input), PUBLISH_PERMISSIONS)}${jobs}${publishJob(input.environment)}${gate}    steps:
      - uses: actions/checkout@v7
      - run: mkdir -p dist && git archive --format=tar HEAD | zstd -19 -o dist/${input.id}.tar.zst
      - uses: ${PUBLISH_ACTION}
        with:
          files: dist/*.tar.zst
${CHANNEL_INPUT}`
}

const sabineVersionOf = (input: SetupInput) =>
  input.format === "sabine" ? (input.sabineVersion ?? SCHELF_SABINE_VERSION) : undefined

function filesWorkflow(environment: string | null | undefined) {
  return `${header(RELEASE_TRIGGER, PUBLISH_PERMISSIONS)}${publishJob(environment)}    steps:
      - uses: actions/checkout@v7
      - uses: ${PUBLISH_ACTION}
        with:
          release-assets: "*"
`
}

export function workflowFor(input: SetupInput) {
  if (input.format === "sabine") return sabineWorkflow(input)
  if (input.format === "appimage") return appImageWorkflow(input.environment)
  if (input.format === "files") return filesWorkflow(input.environment)
  return input.helper ? extensionWithHelperWorkflow(input, input.helper) : extensionWorkflow(input)
}
