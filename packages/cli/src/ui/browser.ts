import { spawn } from "node:child_process"

export function openBrowser(url: string) {
  if (process.env.CI || process.env.SCHELF_NO_BROWSER) return
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  const child = spawn(command[0]!, command.slice(1), { stdio: "ignore", detached: true })
  child.on("error", () => {})
  child.unref()
}
