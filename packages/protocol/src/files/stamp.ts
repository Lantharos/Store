import { z } from "zod"

const DAY_MS = 86_400_000

export const SIGNED_FOR_DAYS = 14

export const stamp = z.object({
  path: z.string(),
  serial: z.number().int().nonnegative(),
  expires: z.iso.datetime(),
})
export type Stamp = z.infer<typeof stamp>
export type Unstamped<Document> = Omit<Document, keyof Stamp>

export function serialAfter(previous: number, now = Date.now()) {
  return Math.max(now, previous + 1)
}

export function expiresIn(days: number, now = Date.now()) {
  return new Date(now + days * DAY_MS).toISOString()
}
