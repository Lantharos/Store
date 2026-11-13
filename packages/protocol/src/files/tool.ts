import { z } from "zod"
import { distribution, platform } from "../platforms.ts"
import { TOOL_KINDS } from "../tools.ts"
import { publisherSummary } from "./catalog.ts"
import { stamp } from "./stamp.ts"

export const toolFile = z.object({
  platform,
  kind: z.enum(TOOL_KINDS),
  url: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  attestation: z.string().nullable(),
})
export type ToolFile = z.infer<typeof toolFile>

export const toolRelease = z.object({
  version: z.string(),
  channel: z.string(),
  published: z.iso.datetime(),
  rollout: z.object({ percent: z.number().int().min(0).max(100), paused: z.boolean() }),
  files: z.array(toolFile),
})
export type ToolRelease = z.infer<typeof toolRelease>

export const toolIndex = stamp.extend({
  version: z.literal(1),
  generated: z.iso.datetime(),
  name: z.string(),
  address: z.string(),
  short: z.boolean(),
  project: z.object({ id: z.string(), address: z.string(), part: z.string().nullable() }),
  publisher: publisherSummary,
  distribution,
  repository: z.string().nullable(),
  ended_channels: z.record(z.string(), z.string()).optional(),
  releases: z.array(toolRelease),
})
export type ToolIndex = z.infer<typeof toolIndex>
