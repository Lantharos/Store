#!/usr/bin/env node
import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { STORE, schelfProgram, thisComputer } from "@schelf/program"

const TERMINAL_SIGNALS = ["SIGINT", "SIGQUIT"] as const
const PASSED_SIGNALS = ["SIGTERM", "SIGHUP"] as const

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function run(program: string, args: string[]) {
  const child = spawn(program, args, { stdio: "inherit" })
  for (const signal of TERMINAL_SIGNALS) process.on(signal, () => {})
  for (const signal of PASSED_SIGNALS) process.on(signal, () => child.kill(signal))
  child.on("error", (error) => fail(`Couldn't start schelf: ${error.message}`))
  child.on("exit", (code, signal) => {
    if (!signal) process.exit(code ?? 1)
    process.removeAllListeners(signal)
    process.kill(process.pid, signal)
  })
}

const target = thisComputer()
if (!target)
  fail(
    "schelf is built for Linux on Intel and ARM computers so far. On Windows, it runs in WSL; macOS is still to come.",
  )

const cache = process.env.XDG_CACHE_HOME || join(homedir(), ".cache")
const program = await schelfProgram({ store: STORE, folder: join(cache, "schelf", "program"), target }).catch(
  (error: unknown) => fail(`Couldn't get schelf from schelf.store: ${(error as Error).message}`),
)
run(program, process.argv.slice(2))
