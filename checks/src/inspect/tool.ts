import type { Inspection } from "./index.ts"

const PROGRAM_KINDS = new Set(["elf", "macho", "pe"])
const MACOS_SYSTEM = /^(\/usr\/lib\/|\/System\/Library\/)/
const WINDOWS_SYSTEM = new Set([
  "advapi32.dll",
  "bcrypt.dll",
  "bcryptprimitives.dll",
  "crypt32.dll",
  "dbghelp.dll",
  "gdi32.dll",
  "iphlpapi.dll",
  "kernel32.dll",
  "msvcrt.dll",
  "ncrypt.dll",
  "ntdll.dll",
  "ole32.dll",
  "oleaut32.dll",
  "powrprof.dll",
  "psapi.dll",
  "rpcrt4.dll",
  "secur32.dll",
  "shell32.dll",
  "shlwapi.dll",
  "synchronization.dll",
  "ucrtbase.dll",
  "user32.dll",
  "userenv.dll",
  "version.dll",
  "winmm.dll",
  "ws2_32.dll",
])

function systemLibrary(kind: string, library: string) {
  if (kind === "macho") return MACOS_SYSTEM.test(library)
  if (kind === "pe") {
    const name = library.toLowerCase()
    return WINDOWS_SYSTEM.has(name) || /^(api|ext)-ms-win-/.test(name)
  }
  return false
}

export interface ToolFacts {
  program: string | null
  problem: string | null
  shared: string[]
}

export function inspectTool(inspection: Inspection, name: string): ToolFacts {
  const refused = (problem: string) => ({ program: null, problem, shared: [] })
  if (inspection.files !== 1) return refused(`${name} holds ${inspection.files} files; a tool is one program`)
  const program = inspection.executables.find((file) => PROGRAM_KINDS.has(file.kind))
  if (!program) return refused(`${name} isn't a compiled program; a tool brings no runtime`)
  const shared = inspection.libraries
    .filter((entry) => entry.file === program.path)
    .flatMap((entry) => entry.libraries)
    .filter((library) => !systemLibrary(program.kind, library))
  return { program: program.path, problem: null, shared }
}
