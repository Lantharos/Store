import { spawn } from "node:child_process"

export interface Output {
  code: number
  stdout: string
  stderr: string
}

export function run(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutSeconds?: number } = {},
) {
  return new Promise<Output>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: (options.timeoutSeconds ?? 600) * 1000,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (code) =>
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    )
  })
}

export async function runChecked(
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutSeconds?: number },
) {
  const output = await run(command, args, options)
  if (output.code !== 0)
    throw new Error(`${command} ${args.join(" ")} failed: ${output.stderr.trim().slice(-500)}`)
  return output.stdout
}
