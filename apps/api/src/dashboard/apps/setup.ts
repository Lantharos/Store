import type { SetupFiles } from "@schelf/protocol"
import type { AppRow } from "../../signing/records.ts"

const SABINE_VERSION = "v0.68.0"

function schelfToml(app: AppRow) {
  return [
    `id = "${app.id}"`,
    `kind = "${app.kind}"`,
    `format = "${app.format}"`,
    ...(app.format === "appimage" ? ['permissions = "permissions.toml"'] : []),
    ...(app.kind === "extension" ? ["", "[requires]", "extension_api = 1"] : []),
    "",
  ].join("\n")
}

const HEADER = `name: Schelf
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write
  attestations: write
jobs:
`

function sabineJobs(environment: string | null) {
  return `  build:
    uses: Lantharos/sabine/.github/workflows/release-app.yml@${SABINE_VERSION}
    with:
      sabine_version: ${SABINE_VERSION}
    secrets: inherit
  publish:
    needs: build
    runs-on: ubuntu-latest${environment ? `\n    environment: ${environment}` : ""}
    steps:
      - uses: actions/download-artifact@v5
        with: { path: dist, merge-multiple: true }
      - uses: Lantharos/schelf-store/publish@v1
        with: { files: dist/* }
`
}

function buildYourOwnJobs(environment: string | null) {
  return `  publish:
    runs-on: ubuntu-latest${environment ? `\n    environment: ${environment}` : ""}
    steps:
      - uses: actions/checkout@v5
      - run: ./build.sh
      - uses: Lantharos/schelf-store/publish@v1
        with: { files: dist/* }
`
}

export function setupFiles(app: AppRow, workflow: string, environment: string | null): SetupFiles {
  return {
    schelf_toml: schelfToml(app),
    workflow_path: workflow,
    workflow_yml:
      HEADER + (app.format === "sabine" ? sabineJobs(environment) : buildYourOwnJobs(environment)),
  }
}
