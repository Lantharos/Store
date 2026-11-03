import process from "node:process"
import { emitKeypressEvents } from "node:readline"
import { createInterface } from "node:readline/promises"
import { accent, bold, muted } from "./style.ts"

const indent = "  "

export async function ask(question: string, initial?: string): Promise<string> {
  const reader = createInterface({ input: process.stdin, output: process.stdout })
  const suffix = initial ? ` ${muted(initial)}` : ""
  try {
    const answer = (await reader.question(`${indent}${accent("?")} ${question}${suffix} `)).trim()
    return answer || initial || ""
  } finally {
    reader.close()
  }
}

export async function confirm(question: string, initial = true): Promise<boolean> {
  const answer = (await ask(`${question} ${muted(initial ? "Y/n" : "y/N")}`)).toLowerCase()
  return answer ? answer.startsWith("y") : initial
}

export interface Choice<T> {
  label: string
  value: T
  detail?: string
}

export function choose<T>(question: string, choices: Choice<T>[]): Promise<T> {
  const input = process.stdin
  const render = (selected: number, first: boolean) => {
    if (!first) process.stdout.write(`\x1b[${choices.length}A`)
    for (const [index, choice] of choices.entries()) {
      const pointer = index === selected ? accent("›") : " "
      const label = index === selected ? bold(choice.label) : choice.label
      const detail = choice.detail ? `  ${muted(choice.detail)}` : ""
      process.stdout.write(`\r\x1b[2K${indent}  ${pointer} ${label}${detail}\n`)
    }
  }
  process.stdout.write(`${indent}${accent("?")} ${question}\n`)
  return new Promise((resolve) => {
    let selected = 0
    emitKeypressEvents(input)
    input.setRawMode(true)
    input.resume()
    render(selected, true)
    const onKey = (_: string, key: { name: string; ctrl: boolean }) => {
      if (key.ctrl && key.name === "c") process.exit(130)
      if (key.name === "up") selected = (selected + choices.length - 1) % choices.length
      if (key.name === "down") selected = (selected + 1) % choices.length
      if (key.name === "return") {
        input.off("keypress", onKey)
        input.setRawMode(false)
        input.pause()
        resolve(choices[selected]!.value)
        return
      }
      render(selected, false)
    }
    input.on("keypress", onKey)
  })
}
