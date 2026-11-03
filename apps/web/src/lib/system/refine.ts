import { detect, type System } from "@schelf/protocol"

interface HighEntropy {
  getHighEntropyValues(hints: string[]): Promise<{ architecture?: string; platform?: string }>
}

export async function refine(system: System): Promise<System> {
  const data = (navigator as Navigator & { userAgentData?: HighEntropy }).userAgentData
  if (!data || system.os === "luft" || system.os === "phone" || system.os === "android") return system
  const values = await data.getHighEntropyValues(["architecture"])
  if (!values.architecture) return system
  return detect(navigator.userAgent, values.platform ?? null, values.architecture)
}
