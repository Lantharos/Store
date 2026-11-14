import { z } from "zod"
import type { PartPlan } from "./parts.ts"
import { STORE_ORIGIN } from "./paths.ts"
import type { ArtifactKind, Platform } from "./platforms.ts"

export const TOOL_PLATFORMS = [
  "linux-x86_64",
  "linux-aarch64",
  "macos-aarch64",
  "macos-x86_64",
  "macos-universal",
  "windows-x86_64",
  "windows-aarch64",
] as const satisfies Platform[]

export const TOOL_KINDS = ["binary", "tarball", "zip", "exe"] as const satisfies ArtifactKind[]
export type ToolKind = (typeof TOOL_KINDS)[number]

export const toolName = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$/,
    "A tool is the name of the program it installs, in lowercase, like sabine",
  )

export const STORE_TOOL = { publisher: "lantharos", name: "schelf" } as const

const SHELLS = ["sh", "bash", "zsh", "fish", "dash", "ksh", "csh", "tcsh", "nu", "pwsh", "elvish", "xonsh"]
const SYSTEM = [
  "schelf",
  "sch",
  "luft",
  "sudo",
  "su",
  "doas",
  "pkexec",
  "login",
  "passwd",
  "init",
  "systemd",
  "systemctl",
  "journalctl",
  "mount",
  "umount",
  "bootc",
  "toolbox",
  "dnf",
  "yum",
  "rpm",
  "apt",
  "apt-get",
  "dpkg",
  "flatpak",
  "snap",
  "brew",
  "pacman",
  "nix",
  "open",
  "xdg-open",
  "which",
  "whereis",
  "file",
  "man",
]
const COREUTILS = [
  "ls",
  "cp",
  "mv",
  "rm",
  "cat",
  "echo",
  "printf",
  "mkdir",
  "rmdir",
  "touch",
  "chmod",
  "chown",
  "chgrp",
  "ln",
  "pwd",
  "cd",
  "test",
  "true",
  "false",
  "head",
  "tail",
  "sort",
  "uniq",
  "wc",
  "cut",
  "tr",
  "tee",
  "date",
  "df",
  "du",
  "id",
  "whoami",
  "env",
  "kill",
  "ps",
  "top",
  "find",
  "grep",
  "sed",
  "awk",
  "xargs",
  "stat",
  "install",
  "sleep",
  "yes",
  "basename",
  "dirname",
  "readlink",
  "realpath",
  "mktemp",
  "sha256sum",
  "md5sum",
  "base64",
  "diff",
  "patch",
  "tar",
  "gzip",
  "gunzip",
  "zip",
  "unzip",
  "xz",
  "zstd",
  "less",
  "more",
]
const WELL_KNOWN = [
  "curl",
  "wget",
  "ssh",
  "scp",
  "sftp",
  "rsync",
  "git",
  "gh",
  "make",
  "cmake",
  "cc",
  "gcc",
  "clang",
  "ld",
  "vi",
  "vim",
  "nvim",
  "nano",
  "emacs",
  "code",
  "python",
  "python3",
  "pip",
  "pip3",
  "pipx",
  "uv",
  "node",
  "npm",
  "npx",
  "yarn",
  "pnpm",
  "bun",
  "bunx",
  "deno",
  "cargo",
  "rustc",
  "rustup",
  "go",
  "java",
  "ruby",
  "gem",
  "perl",
  "php",
  "zig",
  "docker",
  "podman",
  "kubectl",
  "helm",
  "terraform",
  "aws",
  "gcloud",
  "az",
  "wrangler",
  "openssl",
  "gpg",
  "jq",
  "rg",
  "fd",
  "bat",
  "fzf",
  "eza",
  "htop",
  "btop",
  "tmux",
  "screen",
  "zellij",
  "ffmpeg",
  "sqlite3",
  "psql",
  "mysql",
  "nc",
  "nmap",
  "starship",
  "zoxide",
  "just",
  "pandoc",
  "hugo",
  "yt-dlp",
  "ollama",
  "claude",
  "codex",
  "gemini",
]

export const RESERVED_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...SHELLS,
  ...SYSTEM,
  ...COREUTILS,
  ...WELL_KNOWN,
])

export const isReservedToolName = (name: string, publisher: string) =>
  RESERVED_TOOL_NAMES.has(name.toLowerCase()) &&
  !(publisher === STORE_TOOL.publisher && name === STORE_TOOL.name)

export const toolAddress = (publisher: string, name: string) => `${publisher}/${name}`

const TOOL_ADDRESS = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9_-]+)$/

export function splitToolAddress(address: string) {
  const [, publisher, name] = TOOL_ADDRESS.exec(address) ?? []
  return publisher && name ? { publisher, name } : null
}

export interface ToolEntry {
  name: string
  part: string | null
}

export function toolsOf(project: { tool: string | null } & Pick<PartPlan, "parts">): ToolEntry[] {
  return [
    ...(project.tool ? [{ name: project.tool, part: null }] : []),
    ...Object.entries(project.parts).flatMap(([part, settings]) =>
      settings.tool ? [{ name: settings.tool, part }] : [],
    ),
  ]
}

export const installUrl = (tool?: string) => `${STORE_ORIGIN}/install${tool ? `/${tool}` : ""}`

export const installLine = (tool?: string) => `curl -fsSL ${installUrl(tool)} | sh`

export const addLine = (tool: string) => `sch add ${tool}`
