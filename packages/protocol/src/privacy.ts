import { z } from "zod"

export const TELEMETRY = ["none", "opt-in", "opt-out"] as const
export const AI_FEATURES = ["none", "on-device", "online"] as const

export const privacy = z.strictObject({
  telemetry: z
    .enum(TELEMETRY)
    .describe("none, opt-in when people turn it on, or opt-out when it's on until they turn it off"),
  ads: z.boolean().describe("Whether the app shows ads"),
  ai: z
    .enum(AI_FEATURES)
    .describe("none, on-device when AI features run on the computer, or online when they send data away"),
})
export type Privacy = z.infer<typeof privacy>

export const TELEMETRY_WORDS: Record<Privacy["telemetry"], string> = {
  none: "Sends no usage data",
  "opt-in": "Sends usage data only if you turn it on",
  "opt-out": "Sends usage data unless you turn it off",
}

export const AI_WORDS: Record<Privacy["ai"], string> = {
  none: "No AI features",
  "on-device": "AI features run on your computer",
  online: "AI features send what you give them to an online service",
}

export const adsWords = (ads: boolean) => (ads ? "Shows ads" : "No ads")
