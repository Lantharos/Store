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

export function clamavHits(stdout: string, root: string): Hit[] {
  return stdout
    .split("\n")
    .map((line) => CLAMAV_FOUND.exec(line))
    .filter((match) => match !== null)
    .map(([, file, rule]) => ({ engine: "clamav", file: relative(root, file!), rule: rule! }))
}

export function yaraHits(stdout: string, root: string): Hit[] {
  return stdout
    .split("\n")
    .map((line) => YARA_MATCH.exec(line))
    .filter((match) => match !== null)
    .map(([, rule, file]) => ({ engine: "yara", rule: rule!, file: relative(root, file!) }))
}

async function clamav(paths: string[], root: string) {
  const output = await run(
    "clamscan",
    [
      "-r",
      "--infected",
      "--no-summary",
      "--follow-dir-symlinks=0",
      "--follow-file-symlinks=0",
      `--database=${process.env.CLAMAV_DATABASE}`,
      "--max-filesize=1000M",
      "--max-scansize=2000M",
      ...paths,
    ],
    { timeoutSeconds: 1800 },
  )
  if (output.code > 1) throw new Error(`ClamAV failed: ${output.stderr.trim().slice(-500)}`)
  return clamavHits(output.stdout, root)
}

async function yara(paths: string[], root: string) {
  const rules = (await readdir(RULES))
    .filter((name) => name.endsWith(".yar"))
    .map((name) => join(RULES, name))
  const hits: Hit[] = []
  for (const path of paths) {
    const output = await run("yara", ["-r", "-N", "-w", "-f", ...rules, path], { timeoutSeconds: 1800 })
    if (output.code !== 0) throw new Error(`YARA failed: ${output.stderr.trim().slice(-500)}`)
    hits.push(...yaraHits(output.stdout, root))
  }
  return hits
}

export async function scanForMalware(paths: string[], root: string) {
  const [clam, rules] = await Promise.all([clamav(paths, root), yara(paths, root)])
  return [...clam, ...rules]
}
