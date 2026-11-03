import { isProjectId, type SetupFiles, schelfTomlFor, workflowFor } from "@schelf/protocol"
import type { AppRow } from "../../signing/records.ts"

const FIRST_EXTENSION_API = 1

export function setupFiles(
  app: AppRow,
  publisherSlug: string,
  workflow: string,
  environment: string | null,
): SetupFiles {
  const input = {
    id: app.id,
    project: isProjectId(app.id) ? `${publisherSlug}/${app.slug}` : undefined,
    kind: app.kind,
    format: app.format,
    environment,
    extensionApi: app.kind === "extension" ? FIRST_EXTENSION_API : undefined,
  }
  return { schelf_toml: schelfTomlFor(input), workflow_path: workflow, workflow_yml: workflowFor(input) }
}
