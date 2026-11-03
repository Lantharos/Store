import { stringify } from "smol-toml"
import type { Format, Kind } from "./platforms.ts"

export const SCHELF_WORKFLOW = ".github/workflows/schelf.yml"
export const SABINE_REPOSITORY = "Lantharos/Sabine"
export const PUBLISH_ACTION = "Lantharos/schelf-store/publish@v1"

export interface SetupInput {
  id: string
  kind: Kind
  format: Format
  permissions?: string
  listing?: string
  sabineVersion?: string
  extensionApi?: number
}

export function schelfTomlFor(input: SetupInput) {
  const requires = {
    ...(input.sabineVersion && { sabine: input.sabineVersion.replace(/^v/, "") }),
    ...(input.extensionApi !== undefined && { extension_api: input.extensionApi }),
  }
  return stringify({
    id: input.id,
    kind: input.kind,
    format: input.format,
    ...(input.permissions && { permissions: input.permissions }),
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

function sabineWorkflow(version: string) {
  return `${header(["contents: write", ...PUBLISH_PERMISSIONS.slice(1)])}  build:
    uses: ${SABINE_REPOSITORY}/.github/workflows/release-app.yml@${version}
    with:
      sabine_version: ${version}
      # Building the MSI package accepts the WiX 7 licence: https://docs.firegiant.com/wix/osmf/
      accept_wix_eula: true
    secrets: inherit
  publish:
    needs: build
    runs-on: ubuntu-latest
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

function appImageWorkflow() {
  return `${header(PUBLISH_PERMISSIONS)}  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ${PUBLISH_ACTION}
        with:
          release-assets: "*.AppImage"
`
}

function extensionWorkflow(id: string) {
  return `${header(PUBLISH_PERMISSIONS)}  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: mkdir -p dist && git archive --format=tar HEAD | zstd -19 -o dist/${id}.tar.zst
      - uses: ${PUBLISH_ACTION}
        with:
          files: dist/*.tar.zst
`
}

export function workflowFor(input: SetupInput) {
  if (input.format === "sabine") {
    if (!input.sabineVersion)
      throw new Error("A Sabine app's workflow needs the Sabine version it builds with")
    return sabineWorkflow(input.sabineVersion)
  }
  return input.format === "appimage" ? appImageWorkflow() : extensionWorkflow(input.id)
}
