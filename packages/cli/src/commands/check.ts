import type { Args } from "../args.ts"
import { preview } from "../check/preview.ts"
import { validate } from "../check/validate.ts"
import { detectProject } from "../project/detect.ts"
import { repositoryRoot } from "../project/git.ts"
import { blank, caution, done, line, note, problem, title } from "../ui/output.ts"
import { bold } from "../ui/style.ts"

export async function check(_args: Args) {
  const project = await detectProject(await repositoryRoot(process.cwd()))
  const validation = await validate(project)
  title("How the store page will look")
  preview(validation)
  blank()

  const errors = validation.issues.filter((issue) => issue.level === "error")
  const warnings = validation.issues.filter((issue) => issue.level === "warning")
  for (const issue of [...errors, ...warnings]) {
    if (issue.level === "error") problem(issue.message)
    else caution(issue.message)
    if (issue.hint) note(`  ${issue.hint}`)
  }
  if (validation.issues.length) blank()
  if (errors.length) {
    line(
      bold(
        `${errors.length} ${errors.length === 1 ? "thing needs" : "things need"} fixing before a release can go out`,
      ),
    )
    blank()
    return 1
  }
  done(warnings.length ? "Ready to publish. Review will ask about what's missing." : "Ready to publish")
  blank()
  return 0
}
