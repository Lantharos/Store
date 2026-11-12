import process from "node:process"
import { EXIT } from "./exit.ts"
import { accent, bad, bold, dim, good, interactive, muted, warn } from "./style.ts"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const indent = "  "

let json = false

export function printJson() {
  json = true
}

const write = (line = "") => (json ? process.stderr : process.stdout).write(`${line}\n`)

export function emit(data: unknown) {
  if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

export const blank = () => write()
export const title = (text: string) => write(`\n${indent}${bold(text)}\n`)
export const line = (text = "") => write(text ? `${indent}${text}` : "")
export const note = (text: string) => write(`${indent}${muted(text)}`)
export const done = (text: string) => write(`${indent}${good("✓")} ${text}`)
export const caution = (text: string) => write(`${indent}${warn("!")} ${text}`)
export const problem = (text: string) => write(`${indent}${bad("✕")} ${text}`)
export const failure = (text: string) => process.stderr.write(`${indent}${bad("✕")} ${text}\n`)

export function field(label: string, value: string, width = 14) {
  write(`${indent}${muted(label.padEnd(width))}${value}`)
}

export function next(steps: string[]) {
  blank()
  line(bold("Next"))
  steps.forEach((step, index) => {
    line(`${dim(`${index + 1}.`)} ${step}`)
  })
  blank()
}

export async function step<T>(
  label: string,
  work: () => Promise<T>,
  finished?: (result: T) => string,
): Promise<T> {
  if (!interactive) {
    const result = await work()
    done(finished ? finished(result) : label)
    return result
  }
  let frame = 0
  const render = () => process.stdout.write(`\r\x1b[2K${indent}${accent(frames[frame]!)} ${label}`)
  render()
  const timer = setInterval(() => {
    frame = (frame + 1) % frames.length
    render()
  }, 80)
  try {
    const result = await work()
    process.stdout.write("\r\x1b[2K")
    done(finished ? finished(result) : label)
    return result
  } catch (error) {
    process.stdout.write("\r\x1b[2K")
    failure(label)
    throw error
  } finally {
    clearInterval(timer)
  }
}

export class Failure extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    readonly code: number = EXIT.failed,
  ) {
    super(message)
  }
}
