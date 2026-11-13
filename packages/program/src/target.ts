const ARCHITECTURES: Partial<Record<NodeJS.Architecture, string>> = { x64: "x86_64", arm64: "aarch64" }

/** The system schelf is built for that this computer is, when there's one. */
export function thisComputer() {
  const architecture = ARCHITECTURES[process.arch]
  return process.platform === "linux" && architecture ? `linux-${architecture}` : null
}
