import type { CheckResult } from "@schelf/protocol"
import type { Inspection } from "./inspect/index.ts"
import type { Hit } from "./scan.ts"
import type { DiffFacts } from "./source/digest.ts"
import type { LicenceFacts } from "./source/licence.ts"

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export function malwareResult(hits: Hit[]): CheckResult {
  if (!hits.length)
    return { name: "malware", status: "passed", summary: "ClamAV and the store's YARA rules found nothing" }
  return {
    name: "malware",
    status: "warning",
    summary: `${plural(hits.length, "hit")}: ${hits
      .slice(0, 3)
      .map((hit) => `${hit.rule} in ${hit.file}`)
      .join(", ")}`,
    detail: hits,
  }
}

export function inspectionResult(inspections: Record<string, Inspection>): CheckResult {
  const undeclared = Object.entries(inspections).flatMap(([artifact, inspection]) =>
    inspection.permissions.filter((row) => !row.declared).map((row) => ({ artifact, ...row })),
  )
  const setuid = Object.values(inspections).flatMap((inspection) => inspection.setuid)
  const executables = Object.values(inspections).reduce(
    (total, inspection) => total + inspection.executables.length,
    0,
  )
  if (!undeclared.length && !setuid.length)
    return {
      name: "inspection",
      status: "passed",
      summary: `${plural(executables, "executable")} inspected; nothing beyond what's declared`,
    }
  const kinds = [...new Set(undeclared.map((row) => row.permission.split(":")[0]))]
  return {
    name: "inspection",
    status: "warning",
    summary: [
      undeclared.length ? `Uses more than it declares: ${kinds.join(", ")}` : "",
      setuid.length ? `${plural(setuid.length, "setuid file")}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    detail: undeclared,
  }
}

export function licenceResult(licence: LicenceFacts): CheckResult {
  const name = licence.declared ?? licence.detected[0]?.licence
  if (!name)
    return { name: "licence", status: "warning", summary: "No licence found in the repository or the build" }
  const approval = [licence.osi && "OSI", licence.fsf && "FSF"].filter(Boolean).join(" and ")
  if (licence.conflicts.length)
    return { name: "licence", status: "warning", summary: licence.conflicts.join("; "), detail: licence }
  return {
    name: "licence",
    status: approval ? "passed" : "warning",
    summary: approval
      ? `${name}, approved by the ${approval}`
      : `${name}, not an OSI or FSF approved licence`,
    detail: licence,
  }
}

export function diffResult(diff: DiffFacts, from: string, to: string): CheckResult {
  const added = diff.files.reduce((total, file) => total + file.added, 0)
  const removed = diff.files.reduce((total, file) => total + file.removed, 0)
  const flags = [
    diff.newHosts.length && plural(diff.newHosts.length, "new host"),
    diff.suspicious.length && plural(diff.suspicious.length, "binary or encoded file"),
    diff.sensitive.length && `${plural(diff.sensitive.length, "build, CI or permission file")} changed`,
    diff.dependencies.added.length && plural(diff.dependencies.added.length, "new dependency"),
  ].filter(Boolean)
  return {
    name: "diff",
    status: flags.length ? "warning" : "passed",
    summary: `${from}…${to}: ${plural(diff.files.length, "file")}, +${added} -${removed}${flags.length ? `; ${flags.join(", ")}` : ""}`,
  }
}
