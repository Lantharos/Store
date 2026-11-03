import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { run } from "./run.ts"

export interface Hit {
  engine: "clamav" | "yara"
  file: string
  rule: string
}

const RULES = join(import.meta.dir, "..", "rules")
const CLAMAV_FOUND = /^(.*): (.+) FOUND$/
const YARA_MATCH = /^(\S+) (.+)$/

async function clamav(paths: string[], root: string): Promise<Hit[]> {
  const output = await run(
    "clamscan",
    [
      "-r",
      "--infected",
      "--no-summary",
      `--database=${process.env.CLAMAV_DATABASE}`,
      "--max-filesize=1000M",
      "--max-scansize=2000M",
      ...paths,
    ],
    { timeoutSeconds: 1800 },
  )
  if (output.code > 1) throw new Error(`ClamAV failed: ${output.stderr.trim().slice(-500)}`)
  return output.stdout
    .split("\n")
    .map((line) => CLAMAV_FOUND.exec(line))
    .filter((match) => match !== null)
    .map(([, file, rule]) => ({ engine: "clamav", file: relative(root, file!), rule: rule! }))
}

async function yara(paths: string[], root: string): Promise<Hit[]> {
  const rules = (await readdir(RULES))
    .filter((name) => name.endsWith(".yar"))
    .map((name) => join(RULES, name))
  const hits: Hit[] = []
  for (const path of paths) {
    const output = await run("yara", ["-r", "-w", "-f", ...rules, path], { timeoutSeconds: 1800 })
    if (output.code !== 0) throw new Error(`YARA failed: ${output.stderr.trim().slice(-500)}`)
    for (const line of output.stdout.split("\n")) {
      const match = YARA_MATCH.exec(line)
      if (match) hits.push({ engine: "yara", rule: match[1]!, file: relative(root, match[2]!) })
    }
  }
  return hits
}

export async function scanForMalware(paths: string[], root: string) {
  const [clam, rules] = await Promise.all([clamav(paths, root), yara(paths, root)])
  return [...clam, ...rules]
}
