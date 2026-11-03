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
  extensionApi?: number
  helper?: { path: string; build: string }
  environment?: string | null
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

const header = (permissions: string[]) => `name: Schelf

on:
  release:
    types: [published]

permissions:
${permissions.map((permission) => `  ${permission}`).join("\n")}

jobs:
`

const PUBLISH_PERMISSIONS = ["contents: read", "id-token: write", "attestations: write"]

const publishJob = (environment: string | null | undefined) =>
  `  publish:\n    runs-on: ubuntu-latest\n${environment ? `    environment: ${environment}\n` : ""}`

function sabineWorkflow(version: string, environment: string | null | undefined) {
  return `${header(["contents: write", ...PUBLISH_PERMISSIONS.slice(1)])}  build:
    uses: ${SABINE_REPOSITORY}/.github/workflows/release-app.yml@${version}
    with:
      sabine_version: ${version}
      # Building the MSI package accepts the WiX 7 licence: https://docs.firegiant.com/wix/osmf/
      accept_wix_eula: true
    secrets: inherit
${publishJob(environment)}    needs: build
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
`
}

function appImageWorkflow(environment: string | null | undefined) {
  return `${header(PUBLISH_PERMISSIONS)}${publishJob(environment)}    steps:
      - uses: actions/checkout@v7
      - uses: ${PUBLISH_ACTION}
        with:
          release-assets: "*.AppImage"
`
}

function extensionWithHelperWorkflow(
  id: string,
  helper: { path: string; build: string },
  environment: string | null | undefined,
) {
  return `${header(PUBLISH_PERMISSIONS)}  build:
    strategy:
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
          zstd -19 extension.tar -o "dist/${id}-$(uname -m).tar.zst"
      - uses: actions/upload-artifact@v7
        with:
          name: extension-\${{ matrix.runner }}
          path: dist
${publishJob(environment)}    needs: build
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
`
}

function extensionWorkflow(id: string, environment: string | null | undefined) {
  return `${header(PUBLISH_PERMISSIONS)}${publishJob(environment)}    steps:
      - uses: actions/checkout@v7
      - run: mkdir -p dist && git archive --format=tar HEAD | zstd -19 -o dist/${id}.tar.zst
      - uses: ${PUBLISH_ACTION}
        with:
          files: dist/*.tar.zst
`
}

const sabineVersionOf = (input: SetupInput) =>
  input.format === "sabine" ? (input.sabineVersion ?? SCHELF_SABINE_VERSION) : undefined

function filesWorkflow(environment: string | null | undefined) {
  return `${header(PUBLISH_PERMISSIONS)}${publishJob(environment)}    steps:
      - uses: actions/checkout@v7
      - uses: ${PUBLISH_ACTION}
        with:
          release-assets: "*"
`
}

export function workflowFor(input: SetupInput) {
  if (input.format === "sabine") return sabineWorkflow(sabineVersionOf(input)!, input.environment)
  if (input.format === "appimage") return appImageWorkflow(input.environment)
  if (input.format === "files") return filesWorkflow(input.environment)
  return input.helper
    ? extensionWithHelperWorkflow(input.id, input.helper, input.environment)
    : extensionWorkflow(input.id, input.environment)
}
