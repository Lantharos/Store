import { type ConfigIssue, describeIssue } from "@schelf/protocol"

export interface Issue extends ConfigIssue {
  level: "error" | "warning"
  hint?: string
}

export const issueText = (issue: Issue) => describeIssue(issue)

export function errorsFrom(issues: ConfigIssue[]): Issue[] {
  return issues.map((issue) => ({ ...issue, level: "error" }))
}
